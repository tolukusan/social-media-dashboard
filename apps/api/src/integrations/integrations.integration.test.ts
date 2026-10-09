import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import argon2 from 'argon2';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';
import { ProviderClient } from './provider-client.js';
import { IntegrationsService } from './integrations.service.js';
import {
  IntegrationFailure,
  shiftDay,
  sourceToday,
} from './integration-contract.js';
import type { Provider, ProviderResult } from './integration-contract.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const actors: Array<{
  id: string;
  role: string;
  cookie: string;
  csrf: string;
}> = [];
const campaignIds: string[] = [];
const connectionIds: string[] = [];
let serial = Date.now();
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let base: string;
let provider: MockInstance<ProviderClient['fetchCampaign']>;
let originalSettings: Awaited<
  ReturnType<typeof prisma.reportingSettings.findUnique>
>;
const fixture: ProviderResult = {
  observations: [
    {
      date: '2024-05-01',
      values: { ADS_IMPRESSIONS: 100, ADS_CLICKS: 4, ADS_SPEND: 12.5 },
    },
    {
      date: '2024-05-02',
      values: { ADS_IMPRESSIONS: 300, ADS_CLICKS: 6, ADS_SPEND: 30 },
    },
  ],
};
function request(
  path: string,
  method = 'GET',
  body?: unknown,
  actor = actors[0],
  overrides: Record<string, string> = {},
) {
  return fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: actor?.cookie ?? '',
      'x-csrf-token': actor?.csrf ?? '',
      'Content-Type': 'application/json',
      ...overrides,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
async function setupConnection(providerCode: Provider = 'FACEBOOK_ADS') {
  const platform = await prisma.platform.findFirstOrThrow({
    where: { code: providerCode },
  });
  const campaign = await prisma.campaign.create({
    data: {
      name: `Integration fixture ${randomUUID()}`,
      startDate: new Date('2024-01-01'),
      responsibleUserId: actors[0].id,
      createdByUserId: actors[0].id,
      updatedByUserId: actors[0].id,
      campaignChannels: {
        create: {
          channelId: platform.channelId,
          campaignPlatforms: { create: { platformId: platform.id } },
        },
      },
    },
    include: { campaignChannels: { include: { campaignPlatforms: true } } },
  });
  campaignIds.push(campaign.id);
  const body = {
    provider: providerCode,
    platformId: platform.id,
    displayName: 'Fixture connection',
    externalAccountId: String(++serial),
    credentialReference: 'INTEGRATION_FIXTURE_ACCESS_TOKEN',
    sourceTimezone: providerCode === 'LINKEDIN_ADS' ? 'UTC' : 'Africa/Lagos',
    ...(providerCode !== 'ZOHO_CAMPAIGNS' ? { currency: 'NGN' } : {}),
  };
  const response = await request('/integrations', 'POST', body);
  expect(response.status).toBe(201);
  const connection = (await response.json()) as { id: string };
  connectionIds.push(connection.id);
  const contextId = campaign.campaignChannels[0].campaignPlatforms[0].id;
  const mapped = await request(
    `/integrations/${connection.id}/mappings`,
    'POST',
    { campaignPlatformId: contextId, externalCampaignId: String(++serial) },
  );
  expect(mapped.status).toBe(201);
  return {
    id: connection.id,
    contextId,
    campaignId: campaign.id,
    mappingId: ((await mapped.json()) as { id: string }).id,
    body,
  };
}
function configured() {
  vi.stubEnv('INTEGRATION_FIXTURE_ACCESS_TOKEN', 'fixture-token');
  vi.stubEnv('INTEGRATION_META_API_VERSION', 'v23.0');
  vi.stubEnv('INTEGRATION_LINKEDIN_API_VERSION', '202608');
  provider.mockResolvedValue(structuredClone(fixture));
}
async function sync(
  id: string,
  actor = actors[0],
  range = { from: '2024-05-01', to: '2024-05-02' },
) {
  const response = await request(
    `/integrations/${id}/sync`,
    'POST',
    range,
    actor,
  );
  expect(response.status).toBe(201);
  return response.json();
}
async function records(contextId: string) {
  return prisma.performanceRecord.findMany({
    where: { campaignPlatformId: contextId },
    orderBy: { recordDate: 'asc' },
    include: { metricValues: { include: { metricDefinition: true } } },
  });
}

describe('connected-account ingestion and scheduling', () => {
  beforeAll(async () => {
    vi.stubEnv('REPORTING_TIMEZONE', 'Africa/Lagos');
    vi.stubEnv('INTEGRATION_FIXTURE_ACCESS_TOKEN', '');
    originalSettings = await prisma.reportingSettings.findUnique({
      where: { id: 'organisation' },
    });
    await prisma.reportingSettings.upsert({
      where: { id: 'organisation' },
      create: { id: 'organisation', reportingCurrency: 'NGN' },
      update: { reportingCurrency: 'NGN' },
    });
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    provider = vi
      .spyOn(app.get(ProviderClient), 'fetchCampaign')
      .mockResolvedValue(structuredClone(fixture));
    for (const roleCode of ['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT']) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: roleCode },
      });
      const email = `integration-${randomUUID()}@example.invalid`;
      const password = randomUUID() + randomUUID();
      const user = await prisma.user.create({
        data: {
          name: 'Integration fixture',
          email,
          roleId: role.id,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        },
      });
      const actor = { id: user.id, role: roleCode, cookie: '', csrf: '' };
      actors.push(actor);
      const csrf = await request('/auth/csrf');
      actor.csrf = ((await csrf.json()) as { csrfToken: string }).csrfToken;
      const login = await request(
        '/auth/login',
        'POST',
        { email, password },
        actor,
      );
      expect(login.status).toBe(201);
      actor.cookie = `${csrf.headers.get('set-cookie')!.match(/csrf_token=[^;]+/)![0]}; ${login.headers.get('set-cookie')!.match(/smd_session=[^;]+/)![0]}`;
    }
  });
  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await app?.close();
    const rows = await prisma.performanceRecord.findMany({
      where: {
        campaignPlatform: {
          campaignChannel: { campaignId: { in: campaignIds } },
        },
      },
    });
    await prisma.performanceMetricValue.deleteMany({
      where: { performanceRecordId: { in: rows.map((row) => row.id) } },
    });
    await prisma.performanceRecord.deleteMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    await prisma.integrationMapping.deleteMany({
      where: { connectionId: { in: connectionIds } },
    });
    await prisma.integrationRun.deleteMany({
      where: { connectionId: { in: connectionIds } },
    });
    await prisma.integrationConnection.deleteMany({
      where: { id: { in: connectionIds } },
    });
    await prisma.campaignPlatform.deleteMany({
      where: { campaignChannel: { campaignId: { in: campaignIds } } },
    });
    await prisma.campaignChannel.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    const ids = actors.map((actor) => actor.id);
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.reportingSettings.deleteMany();
    if (originalSettings)
      await prisma.reportingSettings.create({ data: originalSettings });
    await prisma.$disconnect();
  });

  it('saves setup without keys, reports BLOCKED without a provider call, and never returns secrets or lease tokens', async () => {
    const connection = await setupConnection();
    provider.mockClear();
    vi.stubEnv('INTEGRATION_FIXTURE_ACCESS_TOKEN', '');
    const run = await sync(connection.id);
    expect(run).toMatchObject({
      status: 'BLOCKED',
      errorCode: 'CREDENTIALS_REQUIRED',
      createdRecords: 0,
    });
    expect(provider).not.toHaveBeenCalled();
    expect(await records(connection.contextId)).toHaveLength(0);
    const response = await request('/integrations');
    const text = await response.text();
    expect(text).not.toMatch(
      /leaseToken|leaseUntil|passwordHash|tokenHash|fixture-token/,
    );
    expect(
      JSON.parse(text).find((item: { id: string }) => item.id === connection.id)
        .configuration.ready,
    ).toBe(false);
  });

  it('enforces anonymous, three-role, Origin, and CSRF boundaries before writes', async () => {
    const connection = await setupConnection();
    expect(
      (
        await request('/integrations', 'GET', undefined, actors[0], {
          Cookie: '',
        })
      ).status,
    ).toBe(401);
    for (const actor of actors.slice(1)) {
      expect(
        (await request('/integrations', 'POST', connection.body, actor)).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/integrations/${connection.id}`,
            'PATCH',
            { autoSync: true },
            actor,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/integrations/${connection.id}/mappings`,
            'POST',
            {
              campaignPlatformId: connection.contextId,
              externalCampaignId: '999',
            },
            actor,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/integrations/${connection.id}/disconnect`,
            'POST',
            {},
            actor,
          )
        ).status,
      ).toBe(403);
      expect(
        (await request('/integrations', 'GET', undefined, actor)).status,
      ).toBe(200);
    }
    expect(
      (
        await request(
          `/integrations/${connection.id}/sync`,
          'POST',
          { from: '2024-05-01', to: '2024-05-02' },
          actors[2],
        )
      ).status,
    ).toBe(403);
    const count = await prisma.integrationRun.count();
    const unsafeHeaders: Array<Record<string, string>> = [
      { Origin: 'https://wrong.invalid' },
      { 'x-csrf-token': '' },
    ];
    for (const overrides of unsafeHeaders)
      expect(
        (
          await request(
            `/integrations/${connection.id}/sync`,
            'POST',
            { from: '2024-05-01', to: '2024-05-02' },
            actors[0],
            overrides,
          )
        ).status,
      ).toBe(403);
    expect(await prisma.integrationRun.count()).toBe(count);
    expect((await sync(connection.id, actors[1])).status).toBe('BLOCKED');
  });

  it('validates IDs, timezone, secret references, unknown fields, null booleans, and duplicate account/mapping constraints', async () => {
    const connection = await setupConnection();
    for (const body of [
      { ...connection.body, credentialReference: 'DATABASE_URL' },
      { ...connection.body, sourceTimezone: 'not/a/timezone' },
      { ...connection.body, token: 'never-accepted' },
      { ...connection.body, currency: null },
    ])
      expect((await request('/integrations', 'POST', body)).status).toBe(400);
    expect(
      (await request('/integrations', 'POST', connection.body)).status,
    ).toBe(409);
    expect(
      (
        await request(`/integrations/${connection.id}`, 'PATCH', {
          autoSync: null,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/integrations/${connection.id}`, 'PATCH', {
          credentialReference: 'DATABASE_URL',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/integrations/${connection.id}`, 'PATCH', {
          sourceTimezone: 'UTC',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/integrations/${connection.id}`, 'PATCH', {
          sourceTimezone: 'Africa/Lagos',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/integrations/${connection.id}/mappings`, 'POST', {
          campaignPlatformId: connection.contextId,
          externalCampaignId: '999',
        })
      ).status,
    ).toBe(409);
    await expect(
      prisma.integrationConnection.delete({ where: { id: connection.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      prisma.$executeRaw`UPDATE social_media_dashboard."IntegrationConnection" SET "credentialReference" = 'DATABASE_URL' WHERE id = ${connection.id}::uuid`,
    ).rejects.toThrow();
    for (const range of [
      { from: '2024-02-30', to: '2024-03-01' },
      { from: '2024-01-01', to: '2024-05-01' },
      { from: '2024-05-02', to: '2024-05-01' },
      { from: '2099-01-01', to: '2099-01-01' },
    ])
      expect(
        (await request(`/integrations/${connection.id}/sync`, 'POST', range))
          .status,
      ).toBe(400);
  });

  it('imports golden daily raw values, is idempotent, corrects owned rows, and feeds filtered aggregate KPI/report services', async () => {
    configured();
    const connection = await setupConnection();
    expect(await sync(connection.id)).toMatchObject({
      status: 'SUCCEEDED',
      createdRecords: 2,
    });
    expect(await sync(connection.id)).toMatchObject({
      unchangedRecords: 2,
      createdRecords: 0,
    });
    const dashboard = await (
      await request(
        `/analytics/dashboard?campaignId=${connection.campaignId}&from=2024-05-01&to=2024-05-02`,
      )
    ).json();
    expect(dashboard.recordCount).toBe(2);
    expect(JSON.stringify(dashboard)).toContain('ADS_CTR');
    const values = await records(connection.contextId);
    expect(values[0].integrationManaged).toBe(true);
    expect(values[0].integrationMappingId).toBe(connection.mappingId);
    expect(
      (
        await request(`/integrations/${connection.id}`, 'PATCH', {
          currency: 'USD',
        })
      ).status,
    ).toBe(409);
    const apiAnalytics = app.get(
      (await import('../analytics/analytics.service.js')).AnalyticsService,
    );
    const aggregate = await apiAnalytics.dashboard({
      campaignId: connection.campaignId,
      from: '2024-05-01',
      to: '2024-05-02',
    });
    expect(aggregate.rawTotals).toMatchObject({
      ADS_IMPRESSIONS: 400,
      ADS_CLICKS: 10,
      ADS_SPEND: 42.5,
    });
    expect(aggregate.derived.ADS_CTR).toBe(2.5);
    expect(aggregate.derived.ADS_CPC).toBe(4.25);
    const filtered = await apiAnalytics.dashboard({
      campaignId: connection.campaignId,
      from: '2024-05-02',
      to: '2024-05-02',
    });
    expect(filtered.rawTotals.ADS_IMPRESSIONS).toBe(300);
    expect(filtered.derived.ADS_CTR).toBe(2);
    const provenance = await (await request('/performance-records')).json();
    expect(
      provenance.find((row: { id: string }) => row.id === values[0].id)
        .integrationMapping.connection.displayName,
    ).toBe('Fixture connection');
    const pdf = await request(
      `/reports/dashboard.pdf?campaignId=${connection.campaignId}&from=2024-05-01&to=2024-05-02`,
    );
    expect(pdf.status).toBe(200);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe('%PDF');
    provider.mockResolvedValueOnce({
      observations: [
        {
          date: '2024-05-01',
          values: { ADS_IMPRESSIONS: 200, ADS_CLICKS: 4, ADS_SPEND: 15 },
        },
      ],
    });
    expect(await sync(connection.id)).toMatchObject({ updatedRecords: 1 });
    expect(await records(connection.contextId)).toHaveLength(2);
  });

  it('preserves manual edits, file/manual rows, and archived rows during provider corrections', async () => {
    configured();
    const connection = await setupConnection();
    await sync(connection.id);
    let rows = await records(connection.contextId);
    const edit = await request(
      `/performance-records/${rows[0].id}`,
      'PATCH',
      { notes: 'Human correction' },
      actors[1],
    );
    expect(edit.status).toBe(200);
    await request(
      `/performance-records/${rows[1].id}`,
      'DELETE',
      undefined,
      actors[0],
    );
    rows = await records(connection.contextId);
    expect(rows[0].integrationManaged).toBe(false);
    expect(rows[1].status).toBe('ARCHIVED');
    provider.mockResolvedValueOnce({
      observations: fixture.observations.map((row) => ({
        ...row,
        values: { ...row.values, ADS_IMPRESSIONS: 999 },
      })),
    });
    expect(await sync(connection.id)).toMatchObject({
      status: 'PARTIAL',
      conflicts: 2,
      updatedRecords: 0,
    });
    expect(await records(connection.contextId)).toEqual(rows);
    const manual = await setupConnection();
    const manualResponse = await request('/performance-records', 'POST', {
      campaignPlatformId: manual.contextId,
      recordDate: '2024-05-01',
      values: { ADS_IMPRESSIONS: 7 },
    });
    expect(manualResponse.status).toBe(201);
    expect(await sync(manual.id)).toMatchObject({
      conflicts: 1,
      createdRecords: 1,
    });
  });

  it('preserves zero and missing days, rejects duplicate/out-of-range dates atomically, and blocks incompatible currency/timezone', async () => {
    configured();
    const connection = await setupConnection();
    provider.mockResolvedValueOnce({ observations: [] });
    expect(await sync(connection.id)).toMatchObject({
      status: 'SUCCEEDED',
      createdRecords: 0,
    });
    provider.mockResolvedValueOnce({
      observations: [{ date: '2024-05-01', values: { ADS_IMPRESSIONS: 0 } }],
    });
    expect(await sync(connection.id)).toMatchObject({ createdRecords: 1 });
    const zero = await records(connection.contextId);
    expect(zero).toHaveLength(1);
    expect(Number(zero[0].metricValues[0].value)).toBe(0);
    const emptyKpis = await (
      await request(`/analytics/dashboard?campaignId=${connection.campaignId}`)
    ).json();
    expect(emptyKpis.rawTotals.ADS_IMPRESSIONS).toBe(0);
    expect(emptyKpis.rawTotals.ADS_CLICKS).toBeNull();
    expect(emptyKpis.derived.ADS_CTR).toBeNull();
    for (const observations of [
      [fixture.observations[0], fixture.observations[0]],
      [{ ...fixture.observations[0], date: '2024-05-03' }],
    ]) {
      provider.mockResolvedValueOnce({ observations });
      expect(await sync(connection.id)).toMatchObject({
        status: 'FAILED',
        errorCode: 'INVALID_DAILY_OBSERVATIONS',
      });
      expect(await records(connection.contextId)).toEqual(zero);
    }
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { currency: 'USD' },
    });
    expect(await sync(connection.id)).toMatchObject({
      errorCode: 'REPORTING_CURRENCY_MISMATCH',
      updatedRecords: 0,
    });
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: { sourceTimezone: 'UTC' },
    });
    expect(await sync(connection.id)).toMatchObject({
      status: 'BLOCKED',
      errorCode: 'SOURCE_TIMEZONE_MISMATCH',
    });
  });

  it('a file merge preserves integration lineage and prevents later automatic replacement of human-supplied metrics', async () => {
    configured();
    const connection = await setupConnection();
    await sync(connection.id);
    const form = new FormData();
    form.set(
      'file',
      new Blob([JSON.stringify([{ date: '2024-05-01', reach: 50 }])], {
        type: 'application/json',
      }),
      `integration-merge-${randomUUID()}.json`,
    );
    const preview = await fetch(`${base}/api/v1/imports/preview`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: actors[0].cookie,
        'x-csrf-token': actors[0].csrf,
      },
      body: form,
    });
    expect(preview.status).toBe(201);
    const batch = (await preview.json()) as { id: string };
    const mapped = await request(`/imports/${batch.id}/map`, 'POST', {
      mapping: { date: 'recordDate', reach: 'ADS_REACH' },
      campaignId: connection.campaignId,
      platformId: connection.body.platformId,
      datasetAction: 'MERGE',
    });
    expect(mapped.status).toBe(201);
    expect(
      (await request(`/imports/${batch.id}/confirm`, 'POST', {})).status,
    ).toBe(201);
    const before = await records(connection.contextId);
    expect(before[0].integrationMappingId).toBe(connection.mappingId);
    expect(before[0].integrationManaged).toBe(false);
    expect(
      before[0].metricValues
        .find((value) => value.metricDefinition.code === 'ADS_REACH')
        ?.value.toNumber(),
    ).toBe(50);
    expect(await sync(connection.id)).toMatchObject({
      conflicts: 1,
      updatedRecords: 0,
    });
    expect(await records(connection.contextId)).toEqual(before);
    // Remove only this isolated test's staging provenance after deleting its record reference.
    await prisma.importRow.deleteMany({ where: { importBatchId: batch.id } });
    await prisma.importBatch.delete({ where: { id: batch.id } });
  });

  it('schedules bounded completed-day sync, records safe provider failures, retries after expiry, and stops deactivated authority', async () => {
    configured();
    const connection = await setupConnection();
    provider.mockRejectedValue(
      new IntegrationFailure(
        'PROVIDER_RATE_LIMITED',
        'safe rate-limit message',
      ),
    );
    await request(`/integrations/${connection.id}`, 'PATCH', {
      autoSync: true,
    });
    await app.get(IntegrationsService).tick();
    const runs = await prisma.integrationRun.findMany({
      where: { connectionId: connection.id },
    });
    expect(runs[0]).toMatchObject({
      status: 'FAILED',
      errorCode: 'PROVIDER_RATE_LIMITED',
      triggeredBy: 'SCHEDULED',
    });
    expect(runs[0].toDate.toISOString().slice(0, 10)).toBe(
      shiftDay(sourceToday('Africa/Lagos'), -1),
    );
    const calls = provider.mock.calls.length;
    await app.get(IntegrationsService).tick();
    expect(provider.mock.calls).toHaveLength(calls);
    await prisma.integrationConnection.update({
      where: { id: connection.id },
      data: {
        autoSync: false,
        leaseToken: randomUUID(),
        leaseUntil: new Date('2020-01-01'),
      },
    });
    await prisma.integrationRun.create({
      data: {
        connectionId: connection.id,
        fromDate: new Date('2024-05-01'),
        toDate: new Date('2024-05-02'),
        triggeredBy: 'MANUAL',
      },
    });
    configured();
    expect(await sync(connection.id)).toMatchObject({ status: 'SUCCEEDED' });
    expect(
      await prisma.integrationRun.count({
        where: { connectionId: connection.id, errorCode: 'SYNC_INTERRUPTED' },
      }),
    ).toBe(1);
    await prisma.user.update({
      where: { id: actors[0].id },
      data: { active: false },
    });
    try {
      const result = await app
        .get(IntegrationsService)
        .sync(
          connection.id,
          { from: '2024-05-01', to: '2024-05-02' },
          actors[1].id,
        );
      expect(result).toMatchObject({
        status: 'BLOCKED',
        errorCode: 'INTEGRATION_AUTHORITY_INACTIVE',
      });
    } finally {
      await prisma.user.update({
        where: { id: actors[0].id },
        data: { active: true },
      });
    }
  });

  it('allows only one concurrent lease and disconnect fences out an in-flight write', async () => {
    configured();
    const connection = await setupConnection();
    let release!: (value: ProviderResult) => void;
    provider.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const service = app.get(IntegrationsService);
    const first = service.sync(
      connection.id,
      { from: '2024-05-01', to: '2024-05-02' },
      actors[0].id,
    );
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    await expect(
      service.sync(
        connection.id,
        { from: '2024-05-01', to: '2024-05-02' },
        actors[1].id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      (await request(`/integrations/${connection.id}/disconnect`, 'POST', {}))
        .status,
    ).toBe(201);
    release(fixture);
    expect(await first).toMatchObject({
      status: 'FAILED',
      errorCode: 'CONNECTION_DISCONNECTED',
    });
    expect(await records(connection.contextId)).toHaveLength(0);
  });

  it('stores Zoho cumulative snapshots without creating daily performance or persisting other response fields', async () => {
    configured();
    const connection = await setupConnection('ZOHO_CAMPAIGNS');
    provider.mockResolvedValueOnce({
      observations: [],
      snapshot: {
        externalCampaignId: 'zoho-key',
        scope: 'CUMULATIVE_CAMPAIGN',
        values: { EMAIL_SENT: 10, EMAIL_OPENS: 5 },
      },
    });
    const run = await sync(connection.id);
    expect(run).toMatchObject({ status: 'SUCCEEDED', createdRecords: 0 });
    expect(run.summary.outcomes[0].snapshot.values).toEqual({
      EMAIL_SENT: 10,
      EMAIL_OPENS: 5,
    });
    expect(await records(connection.contextId)).toHaveLength(0);
    expect(JSON.stringify(run)).not.toContain('fixture-token');
  });
});
