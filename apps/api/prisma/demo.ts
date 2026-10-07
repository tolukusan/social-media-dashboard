import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const DEMO_NAME = '[Demo] Marketing Performance Walkthrough';
const dates = ['2026-09-01', '2026-09-02', '2026-09-03'] as const;
const rows = [
  { SM_REACH: 1200, SM_IMPRESSIONS: 1800, SM_ENGAGEMENTS: 144, SM_LINK_CLICKS: 90 },
  { SM_REACH: 1350, SM_IMPRESSIONS: 2050, SM_ENGAGEMENTS: 176, SM_LINK_CLICKS: 112 },
  { SM_REACH: 1280, SM_IMPRESSIONS: 1940, SM_ENGAGEMENTS: 158, SM_LINK_CLICKS: 101 },
] as const;

async function main() {
  const actor = await prisma.user.findFirst({
    where: {
      active: true,
      role: { code: { in: ['ADMIN', 'MARKETING_OFFICER'] } },
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!actor)
    throw new Error(
      'Demo setup requires an existing active Administrator or Marketing Officer account.',
    );

  const channel = await prisma.marketingChannel.findUniqueOrThrow({
    where: { code: 'SOCIAL' },
  });
  const platform = await prisma.platform.findUniqueOrThrow({
    where: {
      channelId_code: { channelId: channel.id, code: 'FACEBOOK' },
    },
  });
  if (!channel.active || !platform.active)
    throw new Error('Demo setup requires the active seeded Social/Facebook catalogue.');

  const metricDefinitions = await prisma.metricDefinition.findMany({
    where: {
      code: {
        in: [
          'SM_REACH',
          'SM_IMPRESSIONS',
          'SM_ENGAGEMENTS',
          'SM_LINK_CLICKS',
        ],
      },
      active: true,
    },
  });
  const metricByCode = new Map(
    metricDefinitions.map((metric) => [metric.code, metric]),
  );
  if (metricByCode.size !== 4)
    throw new Error('Demo setup could not find all required seeded Social metrics.');

  await prisma.$transaction(async (tx) => {
    let campaign = await tx.campaign.findFirst({
      where: { name: DEMO_NAME, archivedAt: null },
    });
    if (!campaign)
      campaign = await tx.campaign.create({
        data: {
          name: DEMO_NAME,
          description: 'Deterministic local demonstration campaign.',
          objective: 'Demonstrate entry, analytics, targets, and reporting.',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
          endDate: new Date('2026-09-30T00:00:00.000Z'),
          status: 'COMPLETED',
          responsibleUserId: actor.id,
          createdByUserId: actor.id,
          updatedByUserId: actor.id,
        },
      });

    const campaignChannel = await tx.campaignChannel.upsert({
      where: {
        campaignId_channelId: {
          campaignId: campaign.id,
          channelId: channel.id,
        },
      },
      create: { campaignId: campaign.id, channelId: channel.id },
      update: {},
    });
    const campaignPlatform = await tx.campaignPlatform.upsert({
      where: {
        campaignChannelId_platformId: {
          campaignChannelId: campaignChannel.id,
          platformId: platform.id,
        },
      },
      create: {
        campaignChannelId: campaignChannel.id,
        platformId: platform.id,
      },
      update: {},
    });

    for (let index = 0; index < dates.length; index += 1) {
      const recordDate = new Date(`${dates[index]}T00:00:00.000Z`);
      const record = await tx.performanceRecord.upsert({
        where: {
          campaignPlatformId_recordDate: {
            campaignPlatformId: campaignPlatform.id,
            recordDate,
          },
        },
        create: {
          campaignPlatformId: campaignPlatform.id,
          recordDate,
          notes: 'Deterministic demo record.',
          createdByUserId: actor.id,
          updatedByUserId: actor.id,
        },
        update: {
          status: 'ACTIVE',
          archivedAt: null,
          notes: 'Deterministic demo record.',
          updatedByUserId: actor.id,
        },
      });
      for (const [code, value] of Object.entries(rows[index])) {
        const definition = metricByCode.get(code);
        if (!definition) continue;
        await tx.performanceMetricValue.upsert({
          where: {
            performanceRecordId_metricDefinitionId: {
              performanceRecordId: record.id,
              metricDefinitionId: definition.id,
            },
          },
          create: {
            performanceRecordId: record.id,
            metricDefinitionId: definition.id,
            value,
          },
          update: { value },
        });
      }
    }

    const ctr = await tx.kpiDefinition.findFirst({
      where: {
        active: true,
        metricDefinition: { code: 'SM_CTR', active: true },
      },
    });
    if (!ctr) throw new Error('Demo setup requires the seeded Social CTR KPI.');
    const existingTarget = await tx.kpiTarget.findFirst({
      where: {
        kpiDefinitionId: ctr.id,
        scopeType: 'CAMPAIGN',
        campaignId: campaign.id,
        periodType: 'MONTHLY',
        effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      },
    });
    if (!existingTarget)
      await tx.kpiTarget.create({
        data: {
          kpiDefinitionId: ctr.id,
          periodType: 'MONTHLY',
          targetValue: 5,
          scopeType: 'CAMPAIGN',
          campaignId: campaign.id,
          comparisonRule: 'HIGHER_IS_BETTER',
          effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
          effectiveTo: new Date('2026-09-30T00:00:00.000Z'),
          createdByUserId: actor.id,
        },
      });
  });

  process.stdout.write(
    'Demo data is ready: [Demo] Marketing Performance Walkthrough.\n',
  );
}

main().finally(() => prisma.$disconnect());
