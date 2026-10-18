import { ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

export const eligiblePerformanceWhere = {
  status: 'ACTIVE' as const,
  campaignPlatform: { campaignChannel: { campaign: { archivedAt: null } } },
};

// Every campaign-context writer takes this lock before other context locks.
// A single deployment-wide lock gives deletion and ingestion a deterministic order.
export async function lockLifecycle(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('campaign-lifecycle-v1')::bigint)`;
}

export async function requireWritableCampaign(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const campaign = await tx.campaign.findUnique({ where: { id } });
  if (!campaign || campaign.archivedAt)
    throw new ConflictException(
      'Restore the campaign before changing its data.',
    );
  return campaign;
}

export async function preventDeletedImport(
  tx: Prisma.TransactionClient,
  campaignPlatformId: string,
  recordDate: Date,
) {
  if (
    await tx.deletedPerformanceKey.findUnique({
      where: {
        campaignPlatformId_recordDate: { campaignPlatformId, recordDate },
      },
    })
  )
    throw new ConflictException(
      'This daily record was permanently deleted. Automatic import cannot recreate it.',
    );
}
