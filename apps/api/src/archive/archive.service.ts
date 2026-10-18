import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { lockLifecycle } from '../common/lifecycle.js';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

function parsePagination(query: { page: number; pageSize: number }) {
  const page = Number(query.page);
  const pageSize = Number(query.pageSize);
  if (!Number.isSafeInteger(page) || page < 1)
    throw new BadRequestException('Page must be a positive integer.');
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new BadRequestException('Page size must be between 1 and 100.');
  return { page, pageSize };
}

@Injectable()
export class ArchiveService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async campaigns(query: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize } = parsePagination(query);
    const search = query.search?.trim();
    const where = {
      archivedAt: { not: null },
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              ...(isUuid(search) ? [{ id: search }] : []),
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.campaign.count({ where }),
      this.prisma.campaign.findMany({
        where,
        orderBy: [{ archivedAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }
  async records(query: { page: number; pageSize: number; search?: string }) {
    const { page, pageSize } = parsePagination(query);
    const search = query.search?.trim();
    const date =
      search && /^\d{4}-\d{2}-\d{2}$/.test(search)
        ? new Date(`${search}T00:00:00.000Z`)
        : undefined;
    const where = {
      OR: [
        { status: 'ARCHIVED' as const },
        {
          campaignPlatform: {
            campaignChannel: { campaign: { archivedAt: { not: null } } },
          },
        },
      ],
      ...(search
        ? {
            AND: [
              {
                OR: [
                  {
                    campaignPlatform: {
                      campaignChannel: {
                        campaign: {
                          name: {
                            contains: search,
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    },
                  },
                  {
                    campaignPlatform: {
                      platform: {
                        name: {
                          contains: search,
                          mode: 'insensitive' as const,
                        },
                      },
                    },
                  },
                  {
                    campaignPlatform: {
                      campaignChannel: {
                        channel: {
                          name: {
                            contains: search,
                            mode: 'insensitive' as const,
                          },
                        },
                      },
                    },
                  },
                  ...(date && !Number.isNaN(date.valueOf())
                    ? [{ recordDate: date }]
                    : []),
                  ...(isUuid(search) ? [{ id: search }] : []),
                ],
              },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.performanceRecord.count({ where }),
      this.prisma.performanceRecord.findMany({
        where,
        include: {
          campaignPlatform: {
            include: {
              platform: true,
              campaignChannel: { include: { campaign: true, channel: true } },
            },
          },
        },
        orderBy: [
          { archivedAt: { sort: 'desc', nulls: 'last' } },
          { recordDate: 'desc' },
          { id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      pages: Math.ceil(total / pageSize),
    };
  }
  async restore(kind: 'campaigns' | 'records', id: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      if (kind === 'campaigns') {
        const item = await tx.campaign.findUnique({ where: { id } });
        if (!item?.archivedAt)
          throw new NotFoundException('Archived campaign not found.');
        await tx.campaign.update({
          where: { id },
          data: { archivedAt: null, updatedByUserId: actorId },
        });
      } else {
        const item = await tx.performanceRecord.findUnique({
          where: { id },
          include: {
            campaignPlatform: {
              include: { campaignChannel: { include: { campaign: true } } },
            },
          },
        });
        if (!item || item.status !== 'ARCHIVED')
          throw new NotFoundException(
            'Individually archived record not found.',
          );
        if (item.campaignPlatform.campaignChannel.campaign.archivedAt)
          throw new ConflictException('Restore the campaign first.');
        await tx.performanceRecord.update({
          where: { id },
          data: {
            status: 'ACTIVE',
            archivedAt: null,
            updatedByUserId: actorId,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          action: 'RESTORE',
          entityType: kind === 'campaigns' ? 'Campaign' : 'PerformanceRecord',
          entityId: id,
        },
      });
      return { restored: true };
    });
  }
}
