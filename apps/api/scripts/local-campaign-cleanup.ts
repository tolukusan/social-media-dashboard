import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('Missing database configuration');
const target = new URL(connectionString);
if (
  !['localhost', '127.0.0.1', '[::1]', '::1'].includes(target.hostname) ||
  target.pathname.startsWith('/smd_test_')
) {
  throw new Error('Cleanup requires the local application database');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const directory =
  'C:/Users/user/Documents/social-media-dashboard-local-backups';
const backupPath = `${directory}/campaigns-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
try {
  await mkdir(directory, { recursive: true });
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(
        'LOCK TABLE social_media_dashboard."Campaign", social_media_dashboard."CampaignChannel", social_media_dashboard."CampaignPlatform", social_media_dashboard."KpiTarget", social_media_dashboard."PerformanceRecord" IN SHARE ROW EXCLUSIVE MODE',
      );
      if (await tx.performanceRecord.count())
        throw new Error('Performance records exist; campaign cleanup stopped');
      const preserved = async () => ({
        users: await tx.user.count(),
        channels: await tx.marketingChannel.count(),
        platforms: await tx.platform.count(),
        imports: await tx.importBatch.count(),
        settings: await tx.reportingSettings.count(),
        otherTargets: await tx.kpiTarget.count({ where: { campaignId: null } }),
        auditEvents: await tx.auditLog.count(),
      });
      const before = await preserved();
      const snapshot = {
        campaigns: await tx.campaign.findMany(),
        campaignChannels: await tx.campaignChannel.findMany(),
        campaignPlatforms: await tx.campaignPlatform.findMany(),
        campaignTargets: await tx.kpiTarget.findMany({
          where: { campaignId: { not: null } },
        }),
      };
      await writeFile(backupPath, JSON.stringify(snapshot, null, 2), {
        flag: 'wx',
        mode: 0o600,
      });
      const deleted = {
        targets: (
          await tx.kpiTarget.deleteMany({
            where: { campaignId: { not: null } },
          })
        ).count,
        platforms: (await tx.campaignPlatform.deleteMany()).count,
        channels: (await tx.campaignChannel.deleteMany()).count,
        campaigns: (await tx.campaign.deleteMany()).count,
      };
      const remaining = {
        campaigns: await tx.campaign.count(),
        campaignChannels: await tx.campaignChannel.count(),
        campaignPlatforms: await tx.campaignPlatform.count(),
        performanceRecords: await tx.performanceRecord.count(),
      };
      const after = await preserved();
      if (
        JSON.stringify(before) !== JSON.stringify(after) ||
        Object.values(remaining).some(Boolean)
      )
        throw new Error('Cleanup verification failed');
      return { deleted, remaining, preserved: after, backupPath };
    },
    { timeout: 30000 },
  );
  console.log(JSON.stringify(result));
} finally {
  await prisma.$disconnect();
}
