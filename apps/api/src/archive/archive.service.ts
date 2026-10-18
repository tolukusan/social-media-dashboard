import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { lockLifecycle } from '../common/lifecycle.js';

@Injectable()
export class ArchiveService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  campaigns() {
    return this.prisma.campaign.findMany({
      where: { archivedAt: { not: null } },
      orderBy: { archivedAt: 'desc' },
    });
  }
  records() {
    return this.prisma.performanceRecord.findMany({
      where: {
        OR: [
          { status: 'ARCHIVED' },
          {
            campaignPlatform: {
              campaignChannel: { campaign: { archivedAt: { not: null } } },
            },
          },
        ],
      },
      include: {
        campaignPlatform: {
          include: {
            platform: true,
            campaignChannel: { include: { campaign: true, channel: true } },
          },
        },
      },
      orderBy: { recordDate: 'desc' },
    });
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
