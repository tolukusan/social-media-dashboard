import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, test, expect } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { CampaignsService } from '../campaigns/campaigns.service.js';
import { PerformanceService } from '../performance/performance.service.js';
import { ArchiveService } from './archive.service.js';
import { buildDashboardWhere } from '../analytics/analytics.service.js';
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let db: PrismaService;
let actorId: string;
let campaignId: string;
let recordId: string;
beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  db = app.get(PrismaService);
  const role = await db.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const actor = await db.user.create({
    data: {
      name: 'Lifecycle fixture',
      email: `${randomUUID()}@example.invalid`,
      passwordHash: 'unusable-test-fixture',
      roleId: role.id,
    },
  });
  actorId = actor.id;
  const platform = await db.platform.findFirstOrThrow({
    where: { active: true },
  });
  const campaign = await db.campaign.create({
    data: {
      name: 'Archive fixture',
      startDate: new Date('2024-01-01'),
      responsibleUserId: actorId,
      createdByUserId: actorId,
      updatedByUserId: actorId,
      campaignChannels: {
        create: {
          channelId: platform.channelId,
          campaignPlatforms: { create: { platformId: platform.id } },
        },
      },
    },
    include: { campaignChannels: { include: { campaignPlatforms: true } } },
  });
  campaignId = campaign.id;
  const record = await db.performanceRecord.create({
    data: {
      campaignPlatformId: campaign.campaignChannels[0].campaignPlatforms[0].id,
      recordDate: new Date('2024-01-02'),
      createdByUserId: actorId,
      updatedByUserId: actorId,
    },
  });
  recordId = record.id;
});
afterAll(async () => {
  await app.close();
});
test('campaign archival excludes active children; child restore requires restored parent and preserves date uniqueness', async () => {
  const campaigns = app.get(CampaignsService);
  const performance = app.get(PerformanceService);
  const archive = app.get(ArchiveService);
  const count = () =>
    db.performanceRecord.count({ where: buildDashboardWhere({ campaignId }) });
  expect(await count()).toBe(1);
  await performance.archive(recordId, actorId);
  expect(
    (await db.performanceRecord.findUniqueOrThrow({ where: { id: recordId } }))
      .archivedAt,
  ).toBeInstanceOf(Date);
  const archivedRecord = await db.performanceRecord.findUniqueOrThrow({
    where: { id: recordId },
  });
  await expect(
    db.performanceRecord.create({
      data: {
        campaignPlatformId: archivedRecord.campaignPlatformId,
        recordDate: archivedRecord.recordDate,
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    }),
  ).rejects.toMatchObject({ code: 'P2002' });
  await campaigns.archive(campaignId, actorId);
  await expect(archive.restore('records', recordId, actorId)).rejects.toThrow(
    'Restore the campaign first',
  );
  await archive.restore('campaigns', campaignId, actorId);
  expect(await count()).toBe(0);
  await archive.restore('records', recordId, actorId);
  expect(await count()).toBe(1);
  await campaigns.archive(campaignId, actorId);
  expect(await count()).toBe(0);
  expect((await performance.list()).some((r) => r.id === recordId)).toBe(false);
  expect(
    (await db.performanceRecord.findUniqueOrThrow({ where: { id: recordId } }))
      .status,
  ).toBe('ACTIVE');
  await archive.restore('campaigns', campaignId, actorId);
  expect(await count()).toBe(1);
});

test('archive lists search and paginate on the server with deterministic ordering', async () => {
  const archive = app.get(ArchiveService);
  const platform = await db.platform.findFirstOrThrow({
    where: { active: true },
  });
  const marker = `Archive pagination ${randomUUID()}`;
  const fixtures = [];
  for (const suffix of ['A', 'B']) {
    const campaign = await db.campaign.create({
      data: {
        name: `${marker} ${suffix}`,
        startDate: new Date('2024-01-01'),
        responsibleUserId: actorId,
        createdByUserId: actorId,
        updatedByUserId: actorId,
        campaignChannels: {
          create: {
            channelId: platform.channelId,
            campaignPlatforms: { create: { platformId: platform.id } },
          },
        },
      },
      include: { campaignChannels: { include: { campaignPlatforms: true } } },
    });
    const record = await db.performanceRecord.create({
      data: {
        campaignPlatformId:
          campaign.campaignChannels[0].campaignPlatforms[0].id,
        recordDate: new Date('2024-02-01'),
        status: 'ARCHIVED',
        archivedAt: new Date(),
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    await app.get(CampaignsService).archive(campaign.id, actorId);
    fixtures.push({ campaign, record });
  }
  const campaignPage1 = await archive.campaigns({
    page: 1,
    pageSize: 1,
    search: marker,
  });
  const campaignPage2 = await archive.campaigns({
    page: 2,
    pageSize: 1,
    search: marker,
  });
  expect(campaignPage1.total).toBe(2);
  expect(campaignPage1.pages).toBe(2);
  expect(campaignPage1.items).toHaveLength(1);
  expect(campaignPage2.items).toHaveLength(1);
  expect(campaignPage1.items[0].id).not.toBe(campaignPage2.items[0].id);
  expect(
    (await archive.campaigns({ page: 1, pageSize: 1, search: marker })).items[0]
      .id,
  ).toBe(campaignPage1.items[0].id);
  const recordPage1 = await archive.records({
    page: 1,
    pageSize: 1,
    search: marker,
  });
  const recordPage2 = await archive.records({
    page: 2,
    pageSize: 1,
    search: marker,
  });
  expect(recordPage1.total).toBe(2);
  expect(recordPage1.pages).toBe(2);
  expect(recordPage1.items[0].id).not.toBe(recordPage2.items[0].id);
  expect(
    recordPage1.items[0].campaignPlatform.campaignChannel.campaign.name,
  ).toContain(marker);
  expect(fixtures).toHaveLength(2);
});

test('deletion confirms identity, rejects stale/expired/replayed previews, preserves import provenance and audits', async () => {
  const { DeletionService } = await import('./deletion.service.js');
  const deletion = app.get(DeletionService);
  const performance = app.get(PerformanceService);
  await expect(deletion.preview('records', recordId, actorId)).rejects.toThrow(
    'Archive the item',
  );
  await performance.archive(recordId, actorId);
  const batch = await db.importBatch.create({
    data: {
      originalFilename: 'fixture.csv',
      checksum: randomUUID(),
      status: 'COMPLETED',
      importedByUserId: actorId,
      rows: {
        create: {
          sourceRowNumber: 1,
          rawData: {},
          status: 'ACCEPTED',
        },
      },
    },
  });
  await db.performanceRecord.update({
    where: { id: recordId },
    data: { importBatchId: batch.id },
  });
  let preview = await deletion.preview('records', recordId, actorId);
  await expect(
    deletion.remove(
      'records',
      recordId,
      actorId,
      preview.confirmationReference!,
      'wrong',
    ),
  ).rejects.toThrow('text');
  expect(await db.performanceRecord.count({ where: { id: recordId } })).toBe(1);
  await db.performanceRecord.update({
    where: { id: recordId },
    data: { notes: 'changed after preview' },
  });
  await expect(
    deletion.remove(
      'records',
      recordId,
      actorId,
      preview.confirmationReference!,
      preview.typedText,
    ),
  ).rejects.toThrow('Dependencies changed');
  preview = await deletion.preview('records', recordId, actorId);
  await db.archiveDeletionConfirmation.updateMany({
    where: { entityId: recordId },
    data: { expiresAt: new Date(0) },
  });
  await expect(
    deletion.remove(
      'records',
      recordId,
      actorId,
      preview.confirmationReference!,
      preview.typedText,
    ),
  ).rejects.toThrow('expired');
  preview = await deletion.preview('records', recordId, actorId);
  const record = await db.performanceRecord.findUniqueOrThrow({
    where: { id: recordId },
  });
  await deletion.remove(
    'records',
    recordId,
    actorId,
    preview.confirmationReference!,
    preview.typedText,
  );
  await expect(
    deletion.remove(
      'records',
      recordId,
      actorId,
      preview.confirmationReference!,
      preview.typedText,
    ),
  ).rejects.toThrow('invalid');
  expect(
    await db.importBatch.count({
      where: { id: batch.id, status: 'COMPLETED' },
    }),
  ).toBe(1);
  expect(await db.importRow.count({ where: { importBatchId: batch.id } })).toBe(
    1,
  );
  expect(
    await db.deletedPerformanceKey.count({
      where: {
        campaignPlatformId: record.campaignPlatformId,
        recordDate: record.recordDate,
      },
    }),
  ).toBe(1);
  expect(
    await db.auditLog.count({
      where: { entityId: recordId, action: 'PERMANENT_DELETE' },
    }),
  ).toBe(1);
  const { ImportsService } = await import('../imports/imports.service.js');
  const staleBatch = await db.importBatch.create({
    data: {
      originalFilename: 'stale-lifecycle.csv',
      checksum: randomUUID(),
      status: 'READY',
      importedByUserId: actorId,
      rows: {
        create: {
          sourceRowNumber: 1,
          rawData: {},
          status: 'ACCEPTED',
          normalizedPreview: {
            sourceRowNumber: 1,
            campaignId,
            platformId: (
              await db.campaignPlatform.findUniqueOrThrow({
                where: { id: record.campaignPlatformId },
              })
            ).platformId,
            recordDate: record.recordDate.toISOString().slice(0, 10),
            metrics: { SM_ENGAGEMENTS: 1 },
          },
        },
      },
    },
  });
  await expect(app.get(ImportsService).confirm(staleBatch.id)).rejects.toThrow(
    'cannot recreate',
  );
  expect(
    await db.performanceRecord.count({
      where: {
        campaignPlatformId: record.campaignPlatformId,
        recordDate: record.recordDate,
      },
    }),
  ).toBe(0);
  expect(
    await db.importRow.count({ where: { importBatchId: staleBatch.id } }),
  ).toBe(1);
  const { preventDeletedImport } = await import('../common/lifecycle.js');
  await expect(
    db.$transaction((tx) =>
      preventDeletedImport(tx, record.campaignPlatformId, record.recordDate),
    ),
  ).rejects.toThrow('cannot recreate');
});

test('mapping blockers, running sync safety, concurrent confirmation use and dependency-safe campaign deletion', async () => {
  const { DeletionService } = await import('./deletion.service.js');
  const { IntegrationsService } =
    await import('../integrations/integrations.service.js');
  const deletion = app.get(DeletionService);
  const integrations = app.get(IntegrationsService);
  const context = await db.campaignPlatform.findFirstOrThrow({
    where: { campaignChannel: { campaignId } },
  });
  const connection = await db.integrationConnection.create({
    data: {
      provider: 'FACEBOOK_ADS',
      platformId: context.platformId,
      displayName: 'Lifecycle connection',
      externalAccountId: randomUUID(),
      credentialReference: 'INTEGRATION_TEST_ACCESS_TOKEN',
      sourceTimezone: 'UTC',
      configuredByUserId: actorId,
    },
  });
  const mapping = await db.integrationMapping.create({
    data: {
      connectionId: connection.id,
      campaignPlatformId: context.id,
      externalCampaignId: '123456',
    },
  });
  const record = await db.performanceRecord.create({
    data: {
      campaignPlatformId: context.id,
      recordDate: new Date('2024-01-03'),
      createdByUserId: actorId,
      updatedByUserId: actorId,
      integrationMappingId: mapping.id,
      integrationManaged: true,
    },
  });
  await app.get(CampaignsService).archive(campaignId, actorId);
  const blocked = await deletion.preview('campaigns', campaignId, actorId);
  expect(blocked.confirmationReference).toBeNull();
  expect(blocked.blockers[0].mappingId).toBe(mapping.id);
  await db.integrationConnection.update({
    where: { id: connection.id },
    data: {
      leaseUntil: new Date(Date.now() + 60000),
      leaseToken: randomUUID(),
    },
  });
  await expect(
    integrations.unmap(connection.id, mapping.id, actorId),
  ).rejects.toThrow('sync is running');
  await db.integrationConnection.update({
    where: { id: connection.id },
    data: { leaseUntil: null, leaseToken: null },
  });
  await integrations.unmap(connection.id, mapping.id, actorId);
  expect(
    (await db.performanceRecord.findUniqueOrThrow({ where: { id: record.id } }))
      .integrationMappingId,
  ).toBeNull();
  // A provider response captured before unmapping must not recreate its removed mapping.
  const leaseToken = randomUUID();
  await db.integrationConnection.update({
    where: { id: connection.id },
    data: {
      leaseToken,
      leaseUntil: new Date(Date.now() + 60000),
    },
  });
  await expect(
    (
      integrations as unknown as {
        ingest: (...args: unknown[]) => Promise<unknown>;
      }
    ).ingest(
      connection.id,
      leaseToken,
      mapping.id,
      [{ date: '2024-01-03', values: { SM_ENGAGEMENTS: 1 } }],
      actorId,
      '2024-01-03',
      '2024-01-03',
    ),
  ).rejects.toThrow();
  expect(await db.integrationMapping.count({ where: { id: mapping.id } })).toBe(
    0,
  );
  await db.integrationConnection.update({
    where: { id: connection.id },
    data: { leaseToken: null, leaseUntil: null },
  });
  const preview = await deletion.preview('campaigns', campaignId, actorId);
  expect(preview.counts.performanceRecords).toBe(1);
  const results = await Promise.allSettled([
    deletion.remove(
      'campaigns',
      campaignId,
      actorId,
      preview.confirmationReference!,
      preview.typedText,
    ),
    deletion.remove(
      'campaigns',
      campaignId,
      actorId,
      preview.confirmationReference!,
      preview.typedText,
    ),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await db.campaign.count({ where: { id: campaignId } })).toBe(0);
  expect(await db.campaignChannel.count({ where: { campaignId } })).toBe(0);
  expect(
    await db.integrationConnection.count({ where: { id: connection.id } }),
  ).toBe(1);
  expect(await db.platform.count({ where: { id: context.platformId } })).toBe(
    1,
  );
  expect(
    await db.auditLog.count({
      where: { entityId: campaignId, action: 'PERMANENT_DELETE' },
    }),
  ).toBe(1);
});

test('database failure during audit rolls back metrics, record, tombstone and confirmation use', async () => {
  const { DeletionService } = await import('./deletion.service.js');
  const deletion = app.get(DeletionService);
  const platform = await db.platform.findFirstOrThrow();
  const definition = await db.metricDefinition.findFirstOrThrow({
    where: { kind: 'RAW' },
  });
  const campaign = await db.campaign.create({
    data: {
      name: 'Rollback fixture',
      startDate: new Date('2024-01-01'),
      responsibleUserId: actorId,
      createdByUserId: actorId,
      updatedByUserId: actorId,
      campaignChannels: {
        create: {
          channelId: platform.channelId,
          campaignPlatforms: { create: { platformId: platform.id } },
        },
      },
    },
    include: { campaignChannels: { include: { campaignPlatforms: true } } },
  });
  const record = await db.performanceRecord.create({
    data: {
      campaignPlatformId: campaign.campaignChannels[0].campaignPlatforms[0].id,
      recordDate: new Date('2024-01-04'),
      status: 'ARCHIVED',
      archivedAt: new Date(),
      createdByUserId: actorId,
      updatedByUserId: actorId,
      metricValues: { create: { metricDefinitionId: definition.id, value: 0 } },
    },
  });
  const preview = await deletion.preview('records', record.id, actorId);
  await db.$executeRawUnsafe(
    `CREATE FUNCTION social_media_dashboard.usability_fixture_rollback() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'PERMANENT_DELETE' AND NEW."entityId" = '${record.id}' THEN RAISE EXCEPTION 'isolated audit failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    'CREATE TRIGGER usability_fixture_rollback BEFORE INSERT ON social_media_dashboard."AuditLog" FOR EACH ROW EXECUTE FUNCTION social_media_dashboard.usability_fixture_rollback()',
  );
  try {
    await expect(
      deletion.remove(
        'records',
        record.id,
        actorId,
        preview.confirmationReference!,
        preview.typedText,
      ),
    ).rejects.toThrow();
    expect(
      await db.performanceMetricValue.count({
        where: { performanceRecordId: record.id },
      }),
    ).toBe(1);
    expect(await db.performanceRecord.count({ where: { id: record.id } })).toBe(
      1,
    );
    expect(
      await db.deletedPerformanceKey.count({
        where: { deletedRecordId: record.id },
      }),
    ).toBe(0);
    expect(
      (
        await db.archiveDeletionConfirmation.findFirstOrThrow({
          where: { entityId: record.id },
        })
      ).usedAt,
    ).toBeNull();
  } finally {
    await db.$executeRawUnsafe(
      'DROP TRIGGER usability_fixture_rollback ON social_media_dashboard."AuditLog"',
    );
    await db.$executeRawUnsafe(
      'DROP FUNCTION social_media_dashboard.usability_fixture_rollback()',
    );
  }
  await deletion.remove(
    'records',
    record.id,
    actorId,
    preview.confirmationReference!,
    preview.typedText,
  );
});
