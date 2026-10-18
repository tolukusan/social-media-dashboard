import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { lockLifecycle } from '../common/lifecycle.js';
export type ArchiveKind = 'campaigns' | 'records';
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');

@Injectable()
export class DeletionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  private async admin(tx: Prisma.TransactionClient, actorId: string) {
    await tx.$queryRaw`SELECT id FROM social_media_dashboard."User" WHERE id = ${actorId}::uuid FOR SHARE`;
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      include: { role: true },
    });
    if (!actor?.active || !actor.role.active || actor.role.code !== 'ADMIN')
      throw new ForbiddenException('An active Administrator is required.');
  }
  private async snapshot(
    tx: Prisma.TransactionClient,
    kind: ArchiveKind,
    id: string,
  ) {
    if (!['campaigns', 'records'].includes(kind))
      throw new NotFoundException('Archive type not found.');
    const record =
      kind === 'records'
        ? await tx.performanceRecord.findUnique({
            where: { id },
            include: {
              campaignPlatform: { include: { campaignChannel: true } },
            },
          })
        : null;
    const campaignId =
      kind === 'campaigns'
        ? id
        : record?.campaignPlatform.campaignChannel.campaignId;
    const campaign = campaignId
      ? await tx.campaign.findUnique({ where: { id: campaignId } })
      : null;
    if (!campaign || (kind === 'records' && !record))
      throw new NotFoundException('Archived item not found.');
    if (
      kind === 'campaigns'
        ? !campaign.archivedAt
        : record?.status !== 'ARCHIVED'
    )
      throw new ConflictException(
        'Archive the item before permanent deletion.',
      );
    const channels = await tx.campaignChannel.findMany({
      where: { campaignId },
      include: { campaignPlatforms: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    const platformIds =
      kind === 'records'
        ? [record!.campaignPlatformId]
        : channels.flatMap((c) => c.campaignPlatforms.map((p) => p.id));
    const records = await tx.performanceRecord.findMany({
      where:
        kind === 'records'
          ? { id }
          : { campaignPlatformId: { in: platformIds } },
      include: { metricValues: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    });
    const mappings = await tx.integrationMapping.findMany({
      where: { campaignPlatformId: { in: platformIds } },
      include: { connection: { select: { displayName: true } } },
      orderBy: { id: 'asc' },
    });
    const targets =
      kind === 'campaigns'
        ? await tx.kpiTarget.findMany({
            where: { campaignId },
            orderBy: { id: 'asc' },
          })
        : [];
    const retainedImportIds = [
      ...new Set(
        records.flatMap((r) => (r.importBatchId ? [r.importBatchId] : [])),
      ),
    ].sort();
    const counts = {
      performanceRecords: records.length,
      metricValues: records.reduce((n, r) => n + r.metricValues.length, 0),
      campaignTargets: targets.length,
      campaignChannels: kind === 'campaigns' ? channels.length : 0,
      campaignPlatforms: kind === 'campaigns' ? platformIds.length : 0,
    };
    const blockers = mappings.map((m) => ({
      mappingId: m.id,
      connectionId: m.connectionId,
      connectionName: m.connection.displayName,
      message:
        'Remove this campaign mapping in Accounts → Connections before deletion.',
    }));
    const typedText = kind === 'campaigns' ? campaign.name : id;
    const fingerprint = hash(
      JSON.stringify({
        campaign,
        record,
        channels,
        records,
        mappings,
        targets,
      }),
    );
    return {
      campaignId: campaign.id,
      identity: {
        id,
        name:
          kind === 'campaigns'
            ? campaign.name
            : `${campaign.name} · ${record!.recordDate.toISOString().slice(0, 10)} · ${id}`,
      },
      counts,
      blockers,
      typedText,
      fingerprint,
      records,
      retainedImportIds,
      platformIds,
      channelIds: channels.map((c) => c.id),
    };
  }
  async preview(kind: ArchiveKind, id: string, actorId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        await this.admin(tx, actorId);
        const s = await this.snapshot(tx, kind, id);
        const reference = s.blockers.length
          ? null
          : randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + 5 * 60_000);
        if (reference)
          await tx.archiveDeletionConfirmation.create({
            data: {
              tokenHash: hash(reference),
              actorUserId: actorId,
              entityKind: kind,
              entityId: id,
              fingerprint: s.fingerprint,
              typedText: s.typedText,
              expiresAt,
            },
          });
        return {
          identity: s.identity,
          counts: s.counts,
          blockers: s.blockers,
          retainedImportIds: s.retainedImportIds,
          typedText: s.typedText,
          confirmationReference: reference,
          expiresAt,
        };
      },
      { timeout: 30000 },
    );
  }
  async remove(
    kind: ArchiveKind,
    id: string,
    actorId: string,
    reference: string,
    typedText: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        await this.admin(tx, actorId);
        const confirmation = await tx.archiveDeletionConfirmation.findUnique({
          where: { tokenHash: hash(reference) },
        });
        if (
          !confirmation ||
          confirmation.actorUserId !== actorId ||
          confirmation.entityKind !== kind ||
          confirmation.entityId !== id ||
          confirmation.usedAt ||
          confirmation.expiresAt <= new Date()
        )
          throw new ConflictException(
            'Confirmation expired or invalid. Request a fresh preview.',
          );
        const s = await this.snapshot(tx, kind, id);
        if (s.blockers.length || confirmation.fingerprint !== s.fingerprint)
          throw new ConflictException(
            'Dependencies changed. Request a fresh preview.',
          );
        if (typedText !== s.typedText || typedText !== confirmation.typedText)
          throw new ConflictException('The confirmation text does not match.');
        await tx.archiveDeletionConfirmation.update({
          where: { id: confirmation.id },
          data: { usedAt: new Date() },
        });
        for (const record of s.records)
          await tx.deletedPerformanceKey.upsert({
            where: {
              campaignPlatformId_recordDate: {
                campaignPlatformId: record.campaignPlatformId,
                recordDate: record.recordDate,
              },
            },
            create: {
              campaignPlatformId: record.campaignPlatformId,
              recordDate: record.recordDate,
              deletedRecordId: record.id,
            },
            update: {},
          });
        const recordIds = s.records.map((r) => r.id);
        await tx.performanceMetricValue.deleteMany({
          where: { performanceRecordId: { in: recordIds } },
        });
        await tx.performanceRecord.deleteMany({
          where: { id: { in: recordIds } },
        });
        if (kind === 'campaigns') {
          await tx.kpiTarget.deleteMany({ where: { campaignId: id } });
          await tx.campaignPlatform.deleteMany({
            where: { id: { in: s.platformIds } },
          });
          await tx.campaignChannel.deleteMany({
            where: { id: { in: s.channelIds } },
          });
          await tx.campaign.delete({ where: { id } });
        }
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            action: 'PERMANENT_DELETE',
            entityType: kind === 'campaigns' ? 'Campaign' : 'PerformanceRecord',
            entityId: id,
            metadata: {
              counts: s.counts,
              retainedImportIds: s.retainedImportIds,
              campaignId: s.campaignId,
            },
          },
        });
        return { deleted: true, counts: s.counts };
      },
      { timeout: 30000 },
    );
  }
}
