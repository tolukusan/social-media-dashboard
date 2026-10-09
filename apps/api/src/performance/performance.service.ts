import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { CreatePerformanceDto } from './dto/create-performance.dto.js';
import type { UpdatePerformanceDto } from './dto/update-performance.dto.js';

function isPrismaUniqueViolation(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function throwDailyConflict(error: unknown): never {
  if (isPrismaUniqueViolation(error))
    throw new ConflictException({
      code: 'DAILY_RECORD_DATE_TAKEN',
      message:
        'A performance record already uses this campaign platform and date. Archived records retain their date reservation.',
    });
  throw error;
}

function assertValue(code: string, value: number, unit: string) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    (unit === 'COUNT' && !Number.isInteger(value)) ||
    (unit === 'POSITION' && value <= 0)
  )
    throw new BadRequestException({
      code: 'INVALID_METRIC_VALUE',
      message: `Metric ${code} has an invalid value`,
    });
}

@Injectable()
export class PerformanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.performanceRecord.findMany({
      where: { status: 'ACTIVE' },
      include: {
        campaignPlatform: {
          include: {
            platform: true,
            campaignChannel: { include: { channel: true, campaign: true } },
          },
        },
        metricValues: { include: { metricDefinition: true } },
        importBatch: { select: { displayName: true, originalFilename: true } },
        integrationMapping: {
          select: {
            externalCampaignId: true,
            connection: { select: { displayName: true, provider: true } },
          },
        },
      },
      orderBy: { recordDate: 'desc' },
    });
  }
  async create(dto: CreatePerformanceDto, actorId: string) {
    const recordDate = new Date(`${dto.recordDate.slice(0, 10)}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (recordDate > today)
      throw new BadRequestException({
        code: 'FUTURE_RECORD_DATE',
        message: 'Performance records cannot be future dated',
      });
    const context = await this.prisma.campaignPlatform.findUnique({
      where: { id: dto.campaignPlatformId },
      include: {
        platform: true,
        campaignChannel: { include: { campaign: true, channel: true } },
      },
    });
    if (!context)
      throw new NotFoundException({
        code: 'CAMPAIGN_PLATFORM_NOT_FOUND',
        message: 'Campaign platform not found',
      });
    if (
      context.campaignChannel.campaign.archivedAt ||
      !context.campaignChannel.channel.active ||
      !context.platform.active
    )
      throw new BadRequestException({
        code: 'INACTIVE_PERFORMANCE_CONTEXT',
        message:
          'New records require an active campaign, channel, and platform.',
      });
    const start = context.campaignChannel.campaign.startDate;
    const end = context.campaignChannel.campaign.endDate;
    if (recordDate < start || (end && recordDate > end))
      throw new BadRequestException({
        code: 'RECORD_OUTSIDE_CAMPAIGN',
        message: 'Record date must fall within the campaign dates',
      });
    const existing = await this.prisma.performanceRecord.findFirst({
      where: {
        campaignPlatformId: dto.campaignPlatformId,
        recordDate,
      },
    });
    if (existing)
      throw new ConflictException({
        code: 'DAILY_RECORD_DATE_TAKEN',
        message:
          'A performance record already uses this campaign platform and date. Archived records retain their date reservation.',
      });
    const definitions = await this.prisma.channelMetric.findMany({
      where: { channelId: context.campaignChannel.channelId, active: true },
      include: { metricDefinition: true },
    });
    const byCode = new Map(
      definitions.map((item) => [item.metricDefinition.code, item]),
    );
    const values = Object.entries(dto.values);
    for (const [code, value] of values) {
      const mapping = byCode.get(code);
      const definition = mapping?.metricDefinition;
      if (
        !mapping ||
        !definition ||
        !definition.active ||
        !mapping.inputEnabled ||
        definition.kind !== 'RAW'
      )
        throw new BadRequestException({
          code: 'INVALID_RAW_METRIC',
          message: `Metric ${code} is not an applicable raw metric`,
        });
      assertValue(code, value, definition.unit);
    }
    const sent = dto.values.EMAIL_SENT;
    const delivered = dto.values.EMAIL_DELIVERED;
    if (sent !== undefined && delivered !== undefined && delivered > sent)
      throw new BadRequestException({
        code: 'EMAIL_DELIVERED_EXCEEDS_SENT',
        message: 'Delivered emails cannot exceed sent emails',
      });
    return this.prisma
      .$transaction(async (tx) => {
        const record = await tx.performanceRecord.create({
          data: {
            campaignPlatformId: dto.campaignPlatformId,
            recordDate,
            notes: dto.notes,
            createdByUserId: actorId,
            updatedByUserId: actorId,
          },
        });
        await tx.performanceMetricValue.createMany({
          data: values.map(([code, value]) => ({
            performanceRecordId: record.id,
            metricDefinitionId: byCode.get(code)!.metricDefinition.id,
            value,
          })),
        });
        return tx.performanceRecord.findUniqueOrThrow({
          where: { id: record.id },
          include: { metricValues: { include: { metricDefinition: true } } },
        });
      })
      .catch((error: unknown) => throwDailyConflict(error));
  }

  async update(id: string, dto: UpdatePerformanceDto, actorId: string) {
    const existing = await this.prisma.performanceRecord.findUnique({
      where: { id },
      include: {
        campaignPlatform: {
          include: { campaignChannel: { include: { campaign: true } } },
        },
      },
    });
    if (!existing || existing.status !== 'ACTIVE')
      throw new NotFoundException({
        code: 'PERFORMANCE_RECORD_NOT_FOUND',
        message: 'Active performance record not found',
      });
    const recordDate = dto.recordDate
      ? new Date(`${dto.recordDate.slice(0, 10)}T00:00:00.000Z`)
      : existing.recordDate;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (recordDate > today)
      throw new BadRequestException({
        code: 'FUTURE_RECORD_DATE',
        message: 'Performance records cannot be future dated',
      });
    const campaign = existing.campaignPlatform.campaignChannel.campaign;
    if (
      recordDate < campaign.startDate ||
      (campaign.endDate && recordDate > campaign.endDate)
    )
      throw new BadRequestException({
        code: 'RECORD_OUTSIDE_CAMPAIGN',
        message: 'Record date must fall within the campaign dates',
      });
    const duplicate = await this.prisma.performanceRecord.findFirst({
      where: {
        id: { not: id },
        campaignPlatformId: existing.campaignPlatformId,
        recordDate,
      },
    });
    if (duplicate)
      throw new ConflictException({
        code: 'DAILY_RECORD_DATE_TAKEN',
        message:
          'A performance record already uses this campaign platform and date. Archived records retain their date reservation.',
      });
    if (dto.values) {
      const channel = await this.prisma.campaignChannel.findUnique({
        where: { id: existing.campaignPlatform.campaignChannelId },
      });
      const definitions = await this.prisma.channelMetric.findMany({
        where: { channelId: channel!.channelId, active: true },
        include: { metricDefinition: true },
      });
      const byCode = new Map(
        definitions.map((item) => [item.metricDefinition.code, item]),
      );
      for (const [code, value] of Object.entries(dto.values)) {
        const definition = byCode.get(code)?.metricDefinition;
        if (
          !definition ||
          !definition.active ||
          !byCode.get(code)?.inputEnabled ||
          definition.kind !== 'RAW'
        )
          throw new BadRequestException({
            code: 'INVALID_RAW_METRIC',
            message: `Metric ${code} is not an applicable raw metric`,
          });
        assertValue(code, value, definition.unit);
      }
      if (
        dto.values.EMAIL_SENT !== undefined &&
        dto.values.EMAIL_DELIVERED !== undefined &&
        dto.values.EMAIL_DELIVERED > dto.values.EMAIL_SENT
      )
        throw new BadRequestException({
          code: 'EMAIL_DELIVERED_EXCEEDS_SENT',
          message: 'Delivered emails cannot exceed sent emails',
        });
    }
    return this.prisma
      .$transaction(async (tx) => {
        if (dto.values) {
          const channel = await tx.campaignChannel.findUnique({
            where: { id: existing.campaignPlatform.campaignChannelId },
          });
          const mappings = await tx.channelMetric.findMany({
            where: {
              channelId: channel!.channelId,
              active: true,
              metricDefinition: { active: true },
            },
            include: { metricDefinition: true },
          });
          const metricByCode = new Map(
            mappings.map((item) => [item.metricDefinition.code, item]),
          );
          await tx.performanceMetricValue.deleteMany({
            where: { performanceRecordId: id },
          });
          await tx.performanceMetricValue.createMany({
            data: Object.entries(dto.values).map(([code, value]) => ({
              performanceRecordId: id,
              metricDefinitionId: metricByCode.get(code)!.metricDefinition.id,
              value,
            })),
          });
        }
        return tx.performanceRecord.update({
          where: { id },
          data: {
            recordDate,
            ...(dto.notes === undefined ? {} : { notes: dto.notes }),
            updatedByUserId: actorId,
            integrationManaged: false,
          },
          include: { metricValues: { include: { metricDefinition: true } } },
        });
      })
      .catch((error: unknown) => throwDailyConflict(error));
  }

  async archive(id: string, actorId: string) {
    const record = await this.prisma.performanceRecord.findUnique({
      where: { id },
    });
    if (!record || record.status !== 'ACTIVE')
      throw new NotFoundException({
        code: 'PERFORMANCE_RECORD_NOT_FOUND',
        message: 'Active performance record not found',
      });
    return this.prisma.$transaction(async (tx) => {
      const archived = await tx.performanceRecord.update({
        where: { id },
        data: { status: 'ARCHIVED', updatedByUserId: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'ARCHIVE',
          entityType: 'PerformanceRecord',
          entityId: id,
        },
      });
      return archived;
    });
  }
}
