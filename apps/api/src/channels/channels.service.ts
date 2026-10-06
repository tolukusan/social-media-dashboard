import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { CreateChannelDto } from './dto/create-channel.dto.js';
import type { CreatePlatformDto } from './dto/create-platform.dto.js';
import type { UpdateCatalogueDto } from './dto/update-catalogue.dto.js';

function required(value: string | undefined, field: string, max: number) {
  const normalized = value?.trim();
  if (!normalized || normalized.length < 2 || normalized.length > max)
    throw new BadRequestException({
      code: 'INVALID_CATALOGUE_FIELD',
      message: `${field} must contain between 2 and ${max} non-space characters.`,
    });
  return normalized;
}

function uniqueConflict(error: unknown, code: string, label: string): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
    throw new ConflictException({
      code,
      message: `${label} is already in use.`,
    });
  throw error;
}

@Injectable()
export class ChannelsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  listChannels() {
    return this.prisma.marketingChannel.findMany({
      orderBy: { name: 'asc' },
      include: { platforms: { orderBy: { name: 'asc' } } },
    });
  }
  async listChannelMetrics(channelId: string) {
    const channel = await this.prisma.marketingChannel.findUnique({
      where: { id: channelId },
      select: { id: true },
    });
    if (!channel)
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    const mappings = await this.prisma.channelMetric.findMany({
      where: { channelId, active: true, metricDefinition: { active: true } },
      include: { metricDefinition: true },
      orderBy: [{ displayOrder: 'asc' }, { metricDefinition: { name: 'asc' } }],
    });
    return mappings.map(({ metricDefinition, ...mapping }) => ({
      ...metricDefinition,
      inputEnabled: mapping.inputEnabled,
      displayOrder: mapping.displayOrder,
    }));
  }
  createChannel(dto: CreateChannelDto) {
    return this.prisma.marketingChannel
      .create({
        data: {
          code: required(dto.code, 'Code', 50).toUpperCase(),
          name: required(dto.name, 'Name', 120),
          description: dto.description?.trim(),
        },
      })
      .catch((error: unknown) =>
        uniqueConflict(error, 'CHANNEL_CODE_EXISTS', 'Channel code'),
      );
  }
  async deactivateChannel(id: string) {
    const found = await this.prisma.marketingChannel.findUnique({
      where: { id },
    });
    if (!found)
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    return this.prisma.marketingChannel
      .update({
        where: { id },
        data: { active: false, archivedAt: new Date() },
      })
      .catch((error: unknown) =>
        uniqueConflict(error, 'CHANNEL_CODE_EXISTS', 'Channel code'),
      );
  }
  async updateChannel(id: string, dto: UpdateCatalogueDto) {
    const found = await this.prisma.marketingChannel.findUnique({
      where: { id },
    });
    if (!found)
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    const active = dto.active ?? found.active;
    return this.prisma.marketingChannel.update({
      where: { id },
      data: {
        ...(dto.name === undefined
          ? {}
          : { name: required(dto.name, 'Name', 120) }),
        ...(dto.code === undefined
          ? {}
          : { code: required(dto.code, 'Code', 50).toUpperCase() }),
        ...(dto.description === undefined
          ? {}
          : { description: dto.description.trim() }),
        active,
        archivedAt: active ? null : (found.archivedAt ?? new Date()),
      },
    });
  }
  async createPlatform(dto: CreatePlatformDto) {
    const channel = await this.prisma.marketingChannel.findUnique({
      where: { id: dto.channelId },
    });
    if (!channel)
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: 'Channel not found',
      });
    if (!channel.active)
      throw new ConflictException({
        code: 'CHANNEL_INACTIVE',
        message: 'Platform cannot be added to an inactive channel',
      });
    return this.prisma.platform
      .create({
        data: {
          channelId: dto.channelId,
          code: required(dto.code, 'Code', 50).toUpperCase(),
          name: required(dto.name, 'Name', 120),
          description: dto.description?.trim(),
        },
      })
      .catch((error: unknown) =>
        uniqueConflict(error, 'PLATFORM_CODE_EXISTS', 'Platform code'),
      );
  }
  listPlatforms(channelId?: string) {
    return this.prisma.platform.findMany({
      where: channelId ? { channelId } : undefined,
      include: { channel: true },
      orderBy: { name: 'asc' },
    });
  }
  async deactivatePlatform(id: string) {
    const found = await this.prisma.platform.findUnique({ where: { id } });
    if (!found)
      throw new NotFoundException({
        code: 'PLATFORM_NOT_FOUND',
        message: 'Platform not found',
      });
    return this.prisma.platform.update({
      where: { id },
      data: { active: false, archivedAt: new Date() },
    });
  }
  async updatePlatform(id: string, dto: UpdateCatalogueDto) {
    const found = await this.prisma.platform.findUnique({ where: { id } });
    if (!found)
      throw new NotFoundException({
        code: 'PLATFORM_NOT_FOUND',
        message: 'Platform not found',
      });
    const channelId = dto.channelId ?? found.channelId;
    const channel = await this.prisma.marketingChannel.findUnique({
      where: { id: channelId },
    });
    if (!channel || !channel.active)
      throw new ConflictException({
        code: 'CHANNEL_INACTIVE',
        message: 'Platform must belong to an active channel',
      });
    if (channelId !== found.channelId) {
      const references = await this.prisma.campaignPlatform.count({
        where: { platformId: id },
      });
      if (references > 0)
        throw new ConflictException({
          code: 'PLATFORM_CHANNEL_IN_USE',
          message:
            'A platform referenced by a campaign cannot be moved to another channel.',
        });
    }
    const active = dto.active ?? found.active;
    return this.prisma.platform
      .update({
        where: { id },
        data: {
          channelId,
          ...(dto.name === undefined
            ? {}
            : { name: required(dto.name, 'Name', 120) }),
          ...(dto.code === undefined
            ? {}
            : { code: required(dto.code, 'Code', 50).toUpperCase() }),
          ...(dto.description === undefined
            ? {}
            : { description: dto.description.trim() }),
          active,
          archivedAt: active ? null : (found.archivedAt ?? new Date()),
        },
        include: { channel: true },
      })
      .catch((error: unknown) =>
        uniqueConflict(error, 'PLATFORM_CODE_EXISTS', 'Platform code'),
      );
  }
}
