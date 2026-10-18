import { lockLifecycle, requireWritableCampaign } from '../common/lifecycle.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateCampaignDto } from './dto/create-campaign.dto.js';
import type { UpdateCampaignDto } from './dto/update-campaign.dto.js';

@Injectable()
export class CampaignsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  list() {
    return this.prisma.campaign.findMany({
      where: { archivedAt: null },
      include: {
        responsibleUser: { select: { id: true, name: true, email: true } },
        campaignChannels: {
          include: {
            channel: true,
            campaignPlatforms: { include: { platform: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async create(dto: CreateCampaignDto, actorId: string) {
    if (dto.name.trim().length < 2)
      throw new BadRequestException({
        code: 'CAMPAIGN_NAME_INVALID',
        message: 'Campaign name must contain at least two non-space characters',
      });
    if (
      !dto.channels.length ||
      dto.channels.some((selection) => !selection.platformIds.length)
    )
      throw new BadRequestException({
        code: 'CAMPAIGN_CHANNELS_REQUIRED',
        message: 'Select at least one platform for every channel',
      });
    const startDate = new Date(`${dto.startDate.slice(0, 10)}T00:00:00.000Z`);
    const endDate = dto.endDate
      ? new Date(`${dto.endDate.slice(0, 10)}T00:00:00.000Z`)
      : null;
    if (endDate && endDate < startDate)
      throw new BadRequestException({
        code: 'CAMPAIGN_INVALID_DATE_RANGE',
        message: 'Campaign end date cannot be before start date',
      });
    const responsible = await this.prisma.user.findFirst({
      where: { id: dto.responsibleUserId, active: true },
    });
    if (!responsible)
      throw new BadRequestException({
        code: 'RESPONSIBLE_USER_INACTIVE',
        message: 'Responsible user must be active',
      });
    const channelIds = dto.channels.map((selection) => selection.channelId);
    if (new Set(channelIds).size !== channelIds.length)
      throw new ConflictException({
        code: 'DUPLICATE_CAMPAIGN_CHANNEL',
        message: 'A channel may be selected only once',
      });
    const platforms = await this.prisma.platform.findMany({
      where: {
        id: { in: dto.channels.flatMap((selection) => selection.platformIds) },
      },
    });
    const platformById = new Map(
      platforms.map((platform) => [platform.id, platform]),
    );
    for (const selection of dto.channels) {
      const channel = await this.prisma.marketingChannel.findUnique({
        where: { id: selection.channelId },
      });
      if (!channel?.active)
        throw new BadRequestException({
          code: 'CHANNEL_INACTIVE',
          message: 'All selected channels must be active',
        });
      for (const platformId of selection.platformIds) {
        const platform = platformById.get(platformId);
        if (
          !platform ||
          !platform.active ||
          platform.channelId !== selection.channelId
        )
          throw new BadRequestException({
            code: 'PLATFORM_CHANNEL_MISMATCH',
            message: 'Every platform must belong to its selected channel',
          });
      }
    }
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      const campaign = await tx.campaign.create({
        data: {
          name: dto.name.trim(),
          description: dto.description,
          objective: dto.objective,
          targetAudience: dto.targetAudience,
          startDate,
          endDate,
          status: dto.status ?? 'PLANNED',
          budget: dto.budget,
          responsibleUserId: dto.responsibleUserId,
          createdByUserId: actorId,
          updatedByUserId: actorId,
          notes: dto.notes,
        },
      });
      for (const selection of dto.channels) {
        const campaignChannel = await tx.campaignChannel.create({
          data: { campaignId: campaign.id, channelId: selection.channelId },
        });
        await tx.campaignPlatform.createMany({
          data: selection.platformIds.map((platformId) => ({
            campaignChannelId: campaignChannel.id,
            platformId,
          })),
        });
      }
      return tx.campaign.findUniqueOrThrow({
        where: { id: campaign.id },
        include: {
          campaignChannels: {
            include: {
              channel: true,
              campaignPlatforms: { include: { platform: true } },
            },
          },
        },
      });
    });
  }
  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        campaignChannels: {
          include: {
            channel: true,
            campaignPlatforms: { include: { platform: true } },
          },
        },
      },
    });
    if (!campaign)
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found',
      });
    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto, actorId: string) {
    const existing = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        campaignChannels: {
          include: {
            campaignPlatforms: { include: { performanceRecords: true } },
          },
        },
      },
    });
    if (!existing)
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found',
      });
    if (existing.archivedAt)
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found',
      });
    const startDate = dto.startDate
      ? new Date(`${dto.startDate.slice(0, 10)}T00:00:00.000Z`)
      : existing.startDate;
    const endDate =
      dto.endDate === undefined
        ? existing.endDate
        : dto.endDate === null
          ? null
          : new Date(`${dto.endDate.slice(0, 10)}T00:00:00.000Z`);
    if (dto.name !== undefined && dto.name.trim().length < 2)
      throw new BadRequestException({
        code: 'CAMPAIGN_NAME_INVALID',
        message: 'Campaign name must contain at least two non-space characters',
      });
    if (endDate && endDate < startDate)
      throw new BadRequestException({
        code: 'CAMPAIGN_INVALID_DATE_RANGE',
        message: 'Campaign end date cannot be before start date',
      });
    if (dto.responsibleUserId) {
      const responsible = await this.prisma.user.findFirst({
        where: { id: dto.responsibleUserId, active: true },
      });
      if (!responsible)
        throw new BadRequestException({
          code: 'RESPONSIBLE_USER_INACTIVE',
          message: 'Responsible user must be active',
        });
    }
    if (dto.channels) {
      const requested = new Set(
        dto.channels.flatMap((item) => item.platformIds),
      );
      const historical = existing.campaignChannels.flatMap((item) =>
        item.campaignPlatforms
          .filter((link) => link.performanceRecords.length)
          .map((link) => link.platformId),
      );
      if (historical.some((platformId) => !requested.has(platformId)))
        throw new ConflictException({
          code: 'HISTORICAL_LINK_REQUIRED',
          message: 'Historical campaign platform links cannot be removed',
        });
      const current = new Set(
        existing.campaignChannels.flatMap((item) =>
          item.campaignPlatforms.map((link) => link.platformId),
        ),
      );
      if ([...current].some((platformId) => !requested.has(platformId)))
        throw new ConflictException({
          code: 'CAMPAIGN_LINK_REMOVAL_REQUIRES_ARCHIVE',
          message: 'Existing campaign platform links cannot be removed',
        });
      const currentLinks = new Set(
        existing.campaignChannels.flatMap((item) =>
          item.campaignPlatforms.map(
            (link) => `${item.channelId}:${link.platformId}`,
          ),
        ),
      );
      const requestedLinks = new Set(
        dto.channels.flatMap((selection) =>
          selection.platformIds.map(
            (platformId) => `${selection.channelId}:${platformId}`,
          ),
        ),
      );
      const structuralChange = [...requestedLinks].some(
        (link) => !currentLinks.has(link),
      );
      if (existing.status === 'COMPLETED' && structuralChange) {
        const actor = await this.prisma.user.findUnique({
          where: { id: actorId },
          include: { role: true },
        });
        if (actor?.role.code !== 'ADMIN')
          throw new ForbiddenException({
            code: 'COMPLETED_CAMPAIGN_STRUCTURE_ADMIN_ONLY',
            message:
              'Only an Administrator may change channel/platform associations after campaign completion.',
          });
      }
      const createDto = {
        ...dto,
        name: dto.name ?? existing.name,
        startDate: startDate.toISOString(),
        channels: dto.channels,
        responsibleUserId: dto.responsibleUserId ?? existing.responsibleUserId,
      } as CreateCampaignDto;
      await this.validateSelections(createDto);
      return this.prisma.$transaction(async (tx) => {
        await lockLifecycle(tx);
        await requireWritableCampaign(tx, id);
        for (const selection of dto.channels!) {
          const channel = await tx.campaignChannel.upsert({
            where: {
              campaignId_channelId: {
                campaignId: id,
                channelId: selection.channelId,
              },
            },
            create: { campaignId: id, channelId: selection.channelId },
            update: {},
          });
          for (const platformId of selection.platformIds)
            await tx.campaignPlatform.upsert({
              where: {
                campaignChannelId_platformId: {
                  campaignChannelId: channel.id,
                  platformId,
                },
              },
              create: { campaignChannelId: channel.id, platformId },
              update: {},
            });
        }
        return tx.campaign.update({
          where: { id },
          data: {
            ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
            ...(dto.description === undefined
              ? {}
              : { description: dto.description }),
            ...(dto.objective === undefined
              ? {}
              : { objective: dto.objective }),
            ...(dto.targetAudience === undefined
              ? {}
              : { targetAudience: dto.targetAudience }),
            startDate,
            endDate,
            ...(dto.status === undefined ? {} : { status: dto.status }),
            ...(dto.budget === undefined ? {} : { budget: dto.budget }),
            ...(dto.responsibleUserId === undefined
              ? {}
              : { responsibleUserId: dto.responsibleUserId }),
            ...(dto.notes === undefined ? {} : { notes: dto.notes }),
            updatedByUserId: actorId,
          },
          include: {
            campaignChannels: {
              include: {
                channel: true,
                campaignPlatforms: { include: { platform: true } },
              },
            },
          },
        });
      });
    }
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      await requireWritableCampaign(tx, id);
      return tx.campaign.update({
        where: { id },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.description === undefined
            ? {}
            : { description: dto.description }),
          ...(dto.objective === undefined ? {} : { objective: dto.objective }),
          ...(dto.targetAudience === undefined
            ? {}
            : { targetAudience: dto.targetAudience }),
          startDate,
          endDate,
          ...(dto.status === undefined ? {} : { status: dto.status }),
          ...(dto.budget === undefined ? {} : { budget: dto.budget }),
          ...(dto.responsibleUserId === undefined
            ? {}
            : { responsibleUserId: dto.responsibleUserId }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes }),
          updatedByUserId: actorId,
        },
        include: {
          campaignChannels: {
            include: {
              channel: true,
              campaignPlatforms: { include: { platform: true } },
            },
          },
        },
      });
    });
  }

  private async validateSelections(dto: CreateCampaignDto) {
    if (
      !dto.channels.length ||
      dto.channels.some((selection) => !selection.platformIds.length)
    )
      throw new BadRequestException({
        code: 'CAMPAIGN_CHANNELS_REQUIRED',
        message: 'Select at least one platform for every channel',
      });
    const platforms = await this.prisma.platform.findMany({
      where: {
        id: { in: dto.channels.flatMap((selection) => selection.platformIds) },
      },
    });
    for (const selection of dto.channels) {
      const channel = await this.prisma.marketingChannel.findUnique({
        where: { id: selection.channelId },
      });
      if (!channel?.active)
        throw new BadRequestException({
          code: 'CHANNEL_INACTIVE',
          message: 'All selected channels must be active',
        });
      for (const platformId of selection.platformIds) {
        const platform = platforms.find((item) => item.id === platformId);
        if (!platform?.active || platform.channelId !== selection.channelId)
          throw new BadRequestException({
            code: 'PLATFORM_CHANNEL_MISMATCH',
            message: 'Every platform must belong to its selected channel',
          });
      }
    }
  }

  async archive(id: string, actorId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign || campaign.archivedAt)
      throw new NotFoundException({
        code: 'CAMPAIGN_NOT_FOUND',
        message: 'Campaign not found',
      });
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      const current = await tx.campaign.findUnique({ where: { id } });
      if (!current || current.archivedAt)
        throw new NotFoundException({
          code: 'CAMPAIGN_NOT_FOUND',
          message: 'Campaign not found',
        });
      const archived = await tx.campaign.update({
        where: { id },
        data: { archivedAt: new Date(), updatedByUserId: actorId },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'ARCHIVE',
          entityType: 'Campaign',
          entityId: id,
          metadata: { previousStatus: campaign.status },
        },
      });
      return archived;
    });
  }
}
