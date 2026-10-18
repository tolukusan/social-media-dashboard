import {
  lockLifecycle,
  requireWritableCampaign,
  preventDeletedImport,
} from '../common/lifecycle.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateTargetDto } from './dto/create-target.dto.js';
import type { UpdateTargetDto } from './dto/update-target.dto.js';

@Injectable()
export class TargetsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.kpiTarget.findMany({
      include: {
        kpiDefinition: true,
        channel: true,
        platform: true,
        campaign: true,
      },
      orderBy: [{ scopeType: 'desc' }, { effectiveFrom: 'desc' }],
    });
  }

  definitions() {
    return this.prisma.kpiDefinition.findMany({
      where: { active: true, metricDefinition: { active: true } },
      include: { metricDefinition: true },
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateTargetDto, actorId: string) {
    const data = await this.validate(dto);
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${this.lockKey(data)})::bigint)`;
      if (data.campaignId) await requireWritableCampaign(tx, data.campaignId);
      await this.ensureNoOverlap(data, undefined, tx);
      const target = await tx.kpiTarget.create({
        data: { ...data, createdByUserId: actorId },
        include: {
          kpiDefinition: true,
          channel: true,
          platform: true,
          campaign: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'KPI_TARGET_CREATED',
          entityType: 'KpiTarget',
          entityId: target.id,
        },
      });
      return target;
    });
  }

  async update(id: string, dto: UpdateTargetDto, actorId: string) {
    const target = await this.prisma.kpiTarget.findUnique({ where: { id } });
    if (!target)
      throw new NotFoundException({
        code: 'TARGET_NOT_FOUND',
        message: 'KPI target not found',
      });
    const effectiveTo =
      dto.effectiveTo === undefined
        ? target.effectiveTo
        : new Date(`${dto.effectiveTo.slice(0, 10)}T00:00:00.000Z`);
    if (effectiveTo && effectiveTo < target.effectiveFrom)
      throw new BadRequestException({
        code: 'TARGET_INVALID_DATE_RANGE',
        message: 'Target end date cannot be before its start date',
      });
    const next = { ...target, effectiveTo };
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${this.lockKey(next)})::bigint)`;
      if (next.campaignId) await requireWritableCampaign(tx, next.campaignId);
      await this.ensureNoOverlap(next, id, tx);
      const updated = await tx.kpiTarget.update({
        where: { id },
        data: {
          ...(dto.targetValue === undefined
            ? {}
            : { targetValue: dto.targetValue }),
          ...(dto.comparisonRule === undefined
            ? {}
            : { comparisonRule: dto.comparisonRule as never }),
          effectiveTo,
        },
        include: {
          kpiDefinition: true,
          channel: true,
          platform: true,
          campaign: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action:
            dto.effectiveTo !== undefined
              ? 'KPI_TARGET_END_DATE_UPDATED'
              : 'KPI_TARGET_UPDATED',
          entityType: 'KpiTarget',
          entityId: id,
        },
      });
      return updated;
    });
  }

  private async validate(dto: CreateTargetDto) {
    const scopeFields = [dto.channelId, dto.platformId, dto.campaignId].filter(
      Boolean,
    ).length;
    const expected = dto.scopeType === 'GLOBAL' ? 0 : 1;
    if (
      scopeFields !== expected ||
      (dto.scopeType === 'CHANNEL' && !dto.channelId) ||
      (dto.scopeType === 'PLATFORM' && !dto.platformId) ||
      (dto.scopeType === 'CAMPAIGN' && !dto.campaignId)
    )
      throw new BadRequestException({
        code: 'TARGET_SCOPE_INVALID',
        message: 'Target scope fields do not match scope type',
      });
    const effectiveFrom = new Date(
      `${dto.effectiveFrom.slice(0, 10)}T00:00:00.000Z`,
    );
    const effectiveTo = dto.effectiveTo
      ? new Date(`${dto.effectiveTo.slice(0, 10)}T00:00:00.000Z`)
      : null;
    if (effectiveTo && effectiveTo < effectiveFrom)
      throw new BadRequestException({
        code: 'TARGET_INVALID_DATE_RANGE',
        message: 'Target end date cannot be before its start date',
      });
    const kpi = await this.prisma.kpiDefinition.findUnique({
      where: { id: dto.kpiDefinitionId },
    });
    if (!kpi?.active)
      throw new BadRequestException({
        code: 'KPI_DEFINITION_INVALID',
        message: 'KPI definition is not active',
      });
    if (
      dto.channelId &&
      !(await this.prisma.marketingChannel.findUnique({
        where: { id: dto.channelId },
      }))
    )
      throw new BadRequestException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Target channel not found',
      });
    if (
      dto.platformId &&
      !(await this.prisma.platform.findUnique({
        where: { id: dto.platformId },
      }))
    )
      throw new BadRequestException({
        code: 'PLATFORM_NOT_FOUND',
        message: 'Target platform not found',
      });
    if (
      dto.campaignId &&
      !(await this.prisma.campaign.findUnique({
        where: { id: dto.campaignId },
      }))
    )
      throw new BadRequestException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Target campaign not found',
      });
    return {
      kpiDefinitionId: dto.kpiDefinitionId,
      periodType: dto.periodType as never,
      targetValue: dto.targetValue,
      scopeType: dto.scopeType as never,
      channelId: dto.channelId ?? null,
      platformId: dto.platformId ?? null,
      campaignId: dto.campaignId ?? null,
      comparisonRule: dto.comparisonRule as never,
      effectiveFrom,
      effectiveTo,
    };
  }

  private async ensureNoOverlap(
    target: {
      kpiDefinitionId: string;
      scopeType: string;
      channelId?: string | null;
      platformId?: string | null;
      campaignId?: string | null;
      periodType: string;
      effectiveFrom: Date;
      effectiveTo?: Date | null;
    },
    excludeId?: string,
    db: Pick<PrismaService, 'kpiTarget'> = this.prisma,
  ) {
    const candidates = await db.kpiTarget.findMany({
      where: {
        kpiDefinitionId: target.kpiDefinitionId,
        scopeType: target.scopeType as never,
        periodType: target.periodType as never,
        channelId: target.channelId ?? null,
        platformId: target.platformId ?? null,
        campaignId: target.campaignId ?? null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (
      candidates.some(
        (item) =>
          item.effectiveFrom <=
            (target.effectiveTo ?? new Date('9999-12-31')) &&
          (item.effectiveTo ?? new Date('9999-12-31')) >= target.effectiveFrom,
      )
    )
      throw new ConflictException({
        code: 'TARGET_OVERLAP',
        message:
          'Overlapping targets for the same KPI scope and period are not permitted',
      });
  }

  private lockKey(target: {
    kpiDefinitionId: string;
    scopeType: string;
    channelId?: string | null;
    platformId?: string | null;
    campaignId?: string | null;
    periodType: string;
  }) {
    return [
      target.kpiDefinitionId,
      target.scopeType,
      target.channelId ?? '',
      target.platformId ?? '',
      target.campaignId ?? '',
      target.periodType,
    ].join(':');
  }
}
