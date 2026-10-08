import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../src/generated/prisma/client.js';

// Used only after the caller validates an isolated local verification database.
export async function createVerificationData(
  prisma: PrismaClient,
  actorId: string,
  campaignCount = 10,
) {
  const channel = await prisma.marketingChannel.findUniqueOrThrow({
    where: { code: 'SOCIAL' },
  });
  const platform = await prisma.platform.findFirstOrThrow({
    where: { channelId: channel.id, active: true },
  });
  const metrics = await prisma.metricDefinition.findMany({
    where: { code: { in: ['SM_IMPRESSIONS', 'SM_LINK_CLICKS'] } },
  });
  if (metrics.length !== 2)
    throw new Error('Verification requires seeded Social metrics.');
  const prefix = `Verification ${randomUUID()}`;
  const campaignIds: string[] = [];
  try {
    for (
      let campaignIndex = 0;
      campaignIndex < campaignCount;
      campaignIndex += 1
    ) {
      const campaign = await prisma.campaign.create({
        data: {
          name: `${prefix} ${campaignIndex + 1}`,
          startDate: new Date('2024-06-01'),
          endDate: new Date('2024-06-30'),
          status: 'COMPLETED',
          responsibleUserId: actorId,
          createdByUserId: actorId,
          updatedByUserId: actorId,
          campaignChannels: {
            create: {
              channelId: channel.id,
              campaignPlatforms: {
                create: {
                  platformId: platform.id,
                  performanceRecords: {
                    create: Array.from({ length: 30 }, (_, day) => ({
                      recordDate: new Date(Date.UTC(2024, 5, day + 1)),
                      createdByUserId: actorId,
                      updatedByUserId: actorId,
                      metricValues: {
                        create: metrics.map((metric) => ({
                          metricDefinitionId: metric.id,
                          value:
                            metric.code === 'SM_IMPRESSIONS'
                              ? 1000 + campaignIndex * 100 + day * 10
                              : 25 + campaignIndex + day,
                        })),
                      },
                    })),
                  },
                },
              },
            },
          },
        },
      });
      campaignIds.push(campaign.id);
    }
    const records = await prisma.performanceRecord.findMany({
      where: {
        recordDate: new Date('2024-06-30'),
        campaignPlatform: {
          campaignChannel: { campaignId: { in: campaignIds } },
        },
      },
      select: {
        id: true,
        campaignPlatform: {
          select: { campaignChannel: { select: { campaignId: true } } },
        },
      },
    });
    return {
      campaignIds,
      records: campaignIds.map(
        (id) =>
          records.find(
            (record) =>
              record.campaignPlatform.campaignChannel.campaignId === id,
          )!.id,
      ),
      from: '2024-06-01',
      to: '2024-06-30',
      campaignCount,
      recordCount: campaignCount * 30,
      metricValueCount: campaignCount * 60,
    };
  } catch (error) {
    await cleanupVerificationData(prisma, campaignIds);
    throw error;
  }
}

export async function cleanupVerificationData(
  prisma: PrismaClient,
  campaignIds: string[],
) {
  if (!campaignIds.length) return;
  const where = {
    campaignPlatform: { campaignChannel: { campaignId: { in: campaignIds } } },
  };
  await prisma.performanceMetricValue.deleteMany({
    where: { performanceRecord: where },
  });
  await prisma.performanceRecord.deleteMany({ where });
  await prisma.kpiTarget.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaignPlatform.deleteMany({
    where: { campaignChannel: { campaignId: { in: campaignIds } } },
  });
  await prisma.campaignChannel.deleteMany({
    where: { campaignId: { in: campaignIds } },
  });
  await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
}
