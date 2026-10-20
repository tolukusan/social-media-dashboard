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
import { AccountProviderClient } from './account-provider-client.js';
import { ConnectedAccountsService } from './connected-accounts.service.js';
import type { ConnectedCandidate } from './account-provider-client.js';
import type { ProviderSyncResult } from './account-contract.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const origin = 'http://localhost:3000';
const actor = { id: '', cookie: '', csrf: '' };
const userIds: string[] = [];
const accountIds: string[] = [];
const suffix = randomUUID();
const from = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
const to = new Date().toISOString().slice(0, 10);
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let base: string;
let accountProvider: AccountProviderClient;
let exchangeCode: MockInstance<AccountProviderClient['exchangeCode']>;
let discover: MockInstance<AccountProviderClient['discover']>;
let syncProvider: MockInstance<AccountProviderClient['sync']>;
let syncMetaMetrics: MockInstance<
  AccountProviderClient['syncMetaAccountMetrics']
>;
let fetchMetaAudience: MockInstance<
  AccountProviderClient['fetchMetaAudienceSnapshot']
>;
let syncMetaContent: MockInstance<
  AccountProviderClient['syncMetaRecentContent']
>;
let revokeCredentials: MockInstance<AccountProviderClient['revokeCredentials']>;

async function drainSyncJobs(accountId: string) {
  const service = app.get(ConnectedAccountsService) as unknown as {
    claimSyncJob(): Promise<{ id: string; leaseToken: string } | null>;
    processSyncJob(id: string, leaseToken: string): Promise<void>;
  };
  for (let attempt = 0; attempt < 40; attempt++) {
    const pending = await prisma.connectedAccountSyncJob.findFirst({
      where: {
        connectedAccountId: accountId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      select: { id: true },
    });
    if (!pending) return;
    const claimed = await service.claimSyncJob();
    if (!claimed)
      throw new Error('An active fixture sync job could not be claimed.');
    await service.processSyncJob(claimed.id, claimed.leaseToken);
  }
  throw new Error('Fixture sync job exceeded the bounded chunk count.');
}

function request(path: string, method = 'GET', body?: unknown) {
  return fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      Cookie: actor.cookie,
      'x-csrf-token': actor.csrf,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(path.includes('/accounts/oauth/callback?')
      ? { redirect: 'manual' as const }
      : {}),
  });
}

async function connect(provider: 'FACEBOOK' | 'YOUTUBE' | 'ZOHO_CAMPAIGNS') {
  const started = await request('/accounts/oauth/start', 'POST', { provider });
  expect(started.status).toBe(201);
  const { authorizationUrl } = (await started.json()) as {
    authorizationUrl: string;
  };
  const authorization = new URL(authorizationUrl);
  expect(authorization.searchParams.get('redirect_uri')).toBe(
    `${origin}/api/v1/accounts/oauth/callback`,
  );
  if (provider === 'YOUTUBE') {
    expect(authorization.origin).toBe('https://accounts.google.com');
    expect(authorization.searchParams.get('scope')?.split(' ').sort()).toEqual(
      [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/yt-analytics.readonly',
      ].sort(),
    );
  }
  if (provider === 'ZOHO_CAMPAIGNS') {
    expect(authorization.origin).toBe('https://accounts.zoho.com');
    expect(authorization.searchParams.get('scope')).toBe(
      'ZohoCampaigns.campaign.READ',
    );
  }
  const state = authorization.searchParams.get('state');
  expect(state).toMatch(/^[A-Za-z0-9_-]{40,100}$/);

  const callback = await request(
    `/accounts/oauth/callback?state=${encodeURIComponent(state!)}&code=fixture-code`,
  );
  expect(callback.status).toBe(302);
  expect(callback.headers.get('location')).toContain(
    'accountConnection=connected',
  );
  expect(callback.headers.get('cache-control')).toContain('no-store');
  expect(callback.headers.get('referrer-policy')).toBe('no-referrer');
  const attempt = await prisma.accountOAuthState.findFirstOrThrow({
    where: { userId: actor.id, provider },
  });
  expect(attempt.consumedAt).toBeInstanceOf(Date);

  const account = await prisma.connectedAccount.findUniqueOrThrow({
    where: {
      provider_externalAccountId: {
        provider,
        externalAccountId:
          provider === 'FACEBOOK'
            ? `facebook-${suffix}`
            : provider === 'YOUTUBE'
              ? `youtube-${suffix}`
              : `zoho-${suffix}`,
      },
    },
  });
  accountIds.push(account.id);
  expect(account.credentialCiphertext).not.toContain('fixture-access-token');
  return account;
}

function socialResult(date: string): ProviderSyncResult {
  return {
    metrics: [
      {
        date,
        scope: 'SNAPSHOT',
        code: 'AUDIENCE_SIZE',
        sourceMetric: 'followers_count',
        value: 425,
      },
      {
        date,
        scope: 'DAILY',
        code: 'ORGANIC_MEDIA_VIEWS',
        sourceMetric: 'page_media_views',
        value: 68,
      },
    ],
    posts: [
      {
        externalPostId: `facebook-post-${suffix}`,
        title: 'Persisted Facebook post',
        postType: 'PHOTO',
        permalink: 'https://example.invalid/post',
        publishedAt: `${date}T09:00:00.000Z`,
        metricValues: { ORGANIC_VIEWS: 91 },
        dataScope: 'LIFETIME',
      },
    ],
    emailCampaigns: [],
    caveats: [],
  };
}

const socialCandidate: ConnectedCandidate = {
  provider: 'FACEBOOK',
  kind: 'SOCIAL',
  externalAccountId: `facebook-${suffix}`,
  displayName: 'Integration Facebook Page',
  handle: 'integration-page',
  profileUrl: 'https://facebook.com/integration-page',
  profileMetadataExpiresAt: null,
  credentials: { accessToken: 'fixture-access-token' },
  tokenExpiresAt: null,
};

const youtubeCandidate: ConnectedCandidate = {
  ...socialCandidate,
  provider: 'YOUTUBE',
  externalAccountId: `youtube-${suffix}`,
  displayName: 'Integration YouTube channel',
  handle: null,
  profileUrl: null,
  credentials: {
    accessToken: 'youtube-fixture-access-token-do-not-return',
  },
};

const emailCandidate: ConnectedCandidate = {
  provider: 'ZOHO_CAMPAIGNS',
  kind: 'EMAIL',
  externalAccountId: `zoho-${suffix}`,
  displayName: 'Integration Zoho account',
  handle: null,
  profileUrl: null,
  profileMetadataExpiresAt: null,
  credentials: {
    accessToken: 'fixture-access-token',
    refreshToken: 'fixture-refresh-token',
    providerData: { region: 'US' },
  },
  tokenExpiresAt: null,
};

describe('connected account OAuth, sync, reports, and disconnect HTTP flow', () => {
  beforeAll(async () => {
    vi.stubEnv('APP_ORIGIN', origin);
    vi.stubEnv('REPORTING_TIMEZONE', 'UTC');
    vi.stubEnv('INTEGRATIONS_SCHEDULER_ENABLED', 'false');
    vi.stubEnv(
      'INTEGRATION_OAUTH_REDIRECT_URI',
      `${origin}/api/v1/accounts/oauth/callback`,
    );
    vi.stubEnv(
      'INTEGRATION_TOKEN_ENCRYPTION_KEY',
      Buffer.alloc(32, 9).toString('base64'),
    );
    vi.stubEnv('INTEGRATION_META_APP_ID', 'fixture-meta-app');
    vi.stubEnv('INTEGRATION_META_APP_SECRET', 'fixture-meta-secret');
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v23.0');
    vi.stubEnv('INTEGRATION_ZOHO_CLIENT_ID', 'fixture-zoho-client');
    vi.stubEnv('INTEGRATION_ZOHO_CLIENT_SECRET', 'fixture-zoho-secret');
    vi.stubEnv('INTEGRATION_ZOHO_REGION', 'US');
    vi.stubEnv('INTEGRATION_GOOGLE_CLIENT_ID', 'fixture-google-client');
    vi.stubEnv('INTEGRATION_GOOGLE_CLIENT_SECRET', 'fixture-google-secret');

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
    accountProvider = app.get(AccountProviderClient);
    exchangeCode = vi
      .spyOn(accountProvider, 'exchangeCode')
      .mockImplementation(async (provider) => ({
        accessToken: `${provider.toLowerCase()}-fixture-access-token`,
      }));
    discover = vi
      .spyOn(accountProvider, 'discover')
      .mockImplementation(async (provider) => {
        if (provider === 'FACEBOOK') return [socialCandidate];
        if (provider === 'YOUTUBE') return [youtubeCandidate];
        return [emailCandidate];
      });
    syncProvider = vi
      .spyOn(accountProvider, 'sync')
      .mockImplementation(async (account, _credentials, _from, end) => {
        if (account.provider === 'ZOHO_CAMPAIGNS')
          return {
            metrics: [],
            posts: [],
            emailCampaigns: [
              {
                externalCampaignId: `email-campaign-${suffix}`,
                campaignName: 'Persisted email campaign',
                sentAt: `${end}T09:30:00.000Z`,
                metricValues: {
                  SENT: 110,
                  DELIVERED: 100,
                  OPENS: 30,
                  UNIQUE_CLICKS: 8,
                  OPEN_RATE: 29.5,
                  UNIQUE_CLICK_RATE: 7.2,
                },
              },
            ],
            caveats: [],
          };
        return socialResult(end);
      });
    syncMetaMetrics = vi
      .spyOn(accountProvider, 'syncMetaAccountMetrics')
      .mockImplementation(
        async (_account, _credentials, chunkFrom, chunkTo) => {
          const metrics: Awaited<
            ReturnType<AccountProviderClient['syncMetaAccountMetrics']>
          > = [];
          const current = new Date(`${chunkFrom}T00:00:00.000Z`);
          const end = new Date(`${chunkTo}T00:00:00.000Z`);
          while (current <= end) {
            const date = current.toISOString().slice(0, 10);
            metrics.push({
              date,
              scope: 'DAILY',
              code: 'ORGANIC_MEDIA_VIEWS',
              sourceMetric: 'page_media_view:is_from_ads=false',
              value: 68,
            });
            current.setUTCDate(current.getUTCDate() + 1);
          }
          return metrics;
        },
      );
    fetchMetaAudience = vi
      .spyOn(accountProvider, 'fetchMetaAudienceSnapshot')
      .mockImplementation(async (_account, _credentials, snapshotDate) => ({
        date: snapshotDate!,
        scope: 'SNAPSHOT',
        code: 'AUDIENCE_SIZE',
        sourceMetric: 'followers_count',
        value: 425,
      }));
    syncMetaContent = vi
      .spyOn(accountProvider, 'syncMetaRecentContent')
      .mockImplementation(
        async (_account, _credentials, _contentFrom, contentTo) => [
          {
            externalPostId: `facebook-post-${suffix}`,
            title: 'Persisted Facebook post',
            postType: 'PHOTO',
            permalink: 'https://example.invalid/post',
            publishedAt: `${contentTo}T09:00:00.000Z`,
            metricValues: { ORGANIC_VIEWS: 91 },
            dataScope: 'LIFETIME',
          },
        ],
      );
    revokeCredentials = vi
      .spyOn(accountProvider, 'revokeCredentials')
      .mockResolvedValue('revoked');

    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
    });
    const email = `connected-account-${suffix}@example.invalid`;
    const password = `${randomUUID()}-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        name: 'Connected account integration fixture',
        email,
        roleId: role.id,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
    actor.id = user.id;
    userIds.push(user.id);

    const csrf = await fetch(`${base}/api/v1/auth/csrf`, {
      headers: { Origin: origin },
    });
    actor.csrf = ((await csrf.json()) as { csrfToken: string }).csrfToken;
    const csrfCookie = csrf.headers
      .get('set-cookie')
      ?.match(/csrf_token=[^;]+/)?.[0];
    const login = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: csrfCookie ?? '',
        'x-csrf-token': actor.csrf,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
    expect(login.status).toBe(201);
    const sessionCookie = login.headers
      .get('set-cookie')
      ?.match(/smd_session=[^;]+/)?.[0];
    expect(csrfCookie).toBeTruthy();
    expect(sessionCookie).toBeTruthy();
    actor.cookie = `${csrfCookie}; ${sessionCookie}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await app?.close();
    if (accountIds.length) {
      const analyticsRecords =
        await prisma.connectedAccountAnalyticsRecord.findMany({
          where: { connectedAccountId: { in: accountIds } },
          select: { id: true },
        });
      const recordIds = analyticsRecords.map((record) => record.id);
      if (recordIds.length)
        await prisma.connectedAccountMetricValue.deleteMany({
          where: { recordId: { in: recordIds } },
        });
      await prisma.connectedAccountAnalyticsRecord.deleteMany({
        where: { connectedAccountId: { in: accountIds } },
      });
      await prisma.connectedAccount.deleteMany({
        where: { id: { in: accountIds } },
      });
    }
    if (userIds.length) {
      await prisma.connectedAccount.deleteMany({
        where: { connectedByUserId: { in: userIds } },
      });
      await prisma.accountOAuthState.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.auditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
      });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    vi.unstubAllEnvs();
  });

  it('connects, syncs, reports, disconnects with retained history, then deletes data explicitly', async () => {
    const socialAccount = await connect('FACEBOOK');
    expect(exchangeCode).toHaveBeenCalledWith(
      'FACEBOOK',
      'fixture-code',
      `${origin}/api/v1/accounts/oauth/callback`,
    );
    expect(discover).toHaveBeenCalledWith(
      'FACEBOOK',
      expect.objectContaining({ accessToken: 'facebook-fixture-access-token' }),
    );

    const state = await prisma.accountOAuthState.findFirstOrThrow({
      where: { userId: actor.id, provider: 'FACEBOOK' },
    });
    expect(state.consumedAt).toBeInstanceOf(Date);

    const listing = await request('/accounts');
    expect(listing.status).toBe(200);
    const listedAccounts = (await listing.json()) as Array<
      Record<string, unknown>
    >;
    expect(listedAccounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: socialAccount.id,
          provider: 'FACEBOOK',
          displayName: 'Integration Facebook Page',
        }),
      ]),
    );
    expect(JSON.stringify(listedAccounts)).not.toContain(
      'fixture-access-token',
    );
    expect(JSON.stringify(listedAccounts)).not.toContain(
      'credentialCiphertext',
    );

    const bootstrapResponse = await request(
      `/accounts/${socialAccount.id}/sync-jobs/active`,
    );
    expect(bootstrapResponse.status).toBe(200);
    const bootstrap = (await bootstrapResponse.json()) as {
      id: string;
      source: string;
      status: string;
      totalChunks: number;
    };
    expect(bootstrap).toMatchObject({
      source: 'OAUTH',
      status: 'QUEUED',
      totalChunks: expect.any(Number),
    });
    expect(bootstrap.totalChunks).toBeGreaterThan(1);
    await drainSyncJobs(socialAccount.id);
    expect(syncMetaMetrics).toHaveBeenCalled();
    expect(fetchMetaAudience).toHaveBeenCalledTimes(1);
    expect(syncMetaContent).toHaveBeenCalledTimes(1);
    const audienceSnapshotRows =
      await prisma.connectedAccountAnalyticsRecord.findMany({
        where: {
          connectedAccountId: socialAccount.id,
          scope: 'ACCOUNT',
          recordDate: new Date(`${to}T00:00:00.000Z`),
        },
        include: {
          metricValues: {
            where: { metricDefinition: { code: 'AUDIENCE_SIZE' } },
          },
        },
      });
    expect(
      audienceSnapshotRows.flatMap((row) =>
        row.metricValues.map((metric) => Number(metric.value)),
      ),
    ).toEqual([425]);

    const syncResponse = await request(
      `/accounts/${socialAccount.id}/sync`,
      'POST',
      { from, to },
    );
    expect(syncResponse.status).toBe(202);
    const queued = (await syncResponse.json()) as {
      id: string;
      status: string;
    };
    expect(queued).toMatchObject({ status: 'QUEUED', queued: true });
    await drainSyncJobs(socialAccount.id);
    const completedJob = await request(
      `/accounts/${socialAccount.id}/sync-jobs/${queued.id}`,
    );
    expect(completedJob.status).toBe(200);
    expect(await completedJob.json()).toMatchObject({
      id: queued.id,
      status: 'SUCCEEDED',
    });
    expect(syncProvider).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: socialAccount.id }),
      expect.anything(),
      from,
      to,
    );

    const recoveryStart = new Date(`${to}T00:00:00.000Z`);
    recoveryStart.setUTCDate(recoveryStart.getUTCDate() - 30);
    const recoveryFrom = recoveryStart.toISOString().slice(0, 10);
    const syncJobResponse = await request(
      `/accounts/${socialAccount.id}/sync-jobs`,
      'POST',
      { from: recoveryFrom, to },
    );
    expect(syncJobResponse.status).toBe(202);
    const recoveryJob = (await syncJobResponse.json()) as {
      id: string;
      status: string;
      totalChunks: number;
      alreadyRunning: boolean;
    };
    expect(recoveryJob).toMatchObject({
      status: 'QUEUED',
      totalChunks: 2,
      alreadyRunning: false,
    });
    const duplicateSyncJobResponse = await request(
      `/accounts/${socialAccount.id}/sync-jobs`,
      'POST',
      { from: recoveryFrom, to },
    );
    expect(duplicateSyncJobResponse.status).toBe(202);
    expect(await duplicateSyncJobResponse.json()).toMatchObject({
      id: recoveryJob.id,
      alreadyRunning: true,
    });

    const service = app.get(ConnectedAccountsService) as unknown as {
      claimSyncJob(): Promise<{ id: string; leaseToken: string } | null>;
      processSyncJob(id: string, leaseToken: string): Promise<void>;
    };
    const firstClaim = await service.claimSyncJob();
    expect(firstClaim).toMatchObject({ id: recoveryJob.id });
    await service.processSyncJob(firstClaim!.id, firstClaim!.leaseToken);
    const interruptedClaim = await service.claimSyncJob();
    expect(interruptedClaim).toMatchObject({ id: recoveryJob.id });
    const interruptedChunk =
      await prisma.connectedAccountSyncChunk.findFirstOrThrow({
        where: { jobId: recoveryJob.id, status: 'QUEUED' },
        orderBy: { sequence: 'asc' },
      });
    await prisma.connectedAccountSyncChunk.update({
      where: { id: interruptedChunk.id },
      data: {
        status: 'RUNNING',
        attemptCount: 1,
        updatedAt: new Date(Date.now() - 6 * 60_000),
      },
    });
    await prisma.connectedAccountSyncJob.update({
      where: { id: recoveryJob.id },
      data: { leaseUntil: new Date(Date.now() - 60_000) },
    });
    const recoveredClaim = await service.claimSyncJob();
    expect(recoveredClaim).toMatchObject({ id: recoveryJob.id });
    await service.processSyncJob(
      recoveredClaim!.id,
      recoveredClaim!.leaseToken,
    );
    const recoveredJob = await prisma.connectedAccountSyncJob.findUniqueOrThrow(
      {
        where: { id: recoveryJob.id },
        include: { chunks: true },
      },
    );
    expect(recoveredJob.status).toBe('SUCCEEDED');
    expect(recoveredJob.chunks).toHaveLength(2);
    expect(
      recoveredJob.chunks.every((chunk) => chunk.status === 'SUCCEEDED'),
    ).toBe(true);
    expect(
      recoveredJob.chunks.find((chunk) => chunk.id === interruptedChunk.id)
        ?.attemptCount,
    ).toBe(2);

    const analyticsResponse = await request(
      `/accounts/${socialAccount.id}/analytics?from=${from}&to=${to}`,
    );
    expect(analyticsResponse.status).toBe(200);
    const analytics = (await analyticsResponse.json()) as {
      metrics: Array<{ code: string; value: number | null }>;
      topPosts: Array<{ dataScope: string; metricValue: number | null }>;
      caveats: string[];
      coverage: {
        requestedDays: number;
        latestSuccessfulHistoryFetchAt: string | null;
      };
    };
    expect(analytics.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'AUDIENCE_SIZE', value: 425 }),
        expect.objectContaining({ code: 'ORGANIC_MEDIA_VIEWS', value: 204 }),
      ]),
    );
    expect(analytics.topPosts).toEqual([]);
    expect(analytics.coverage.requestedDays).toBeGreaterThan(0);
    expect(analytics.coverage.latestSuccessfulHistoryFetchAt).toBeTruthy();
    expect(analytics.caveats.join(' ')).toContain(
      'not a complete annual ranking',
    );
    expect(analytics.caveats.join(' ')).toContain(
      'not a deduplicated count of unique people',
    );

    const pdfResponse = await request(
      `/accounts/${socialAccount.id}/report.pdf?from=${from}&to=${to}`,
    );
    expect(pdfResponse.status).toBe(200);
    expect(pdfResponse.headers.get('content-type')).toContain(
      'application/pdf',
    );
    expect(
      Buffer.from(await pdfResponse.arrayBuffer()).toString('ascii', 0, 5),
    ).toBe('%PDF-');

    const youtubeAccount = await connect('YOUTUBE');
    expect(exchangeCode).toHaveBeenCalledWith(
      'YOUTUBE',
      'fixture-code',
      `${origin}/api/v1/accounts/oauth/callback`,
    );
    expect(youtubeAccount).toMatchObject({
      provider: 'YOUTUBE',
      displayName: 'Integration YouTube channel',
      active: true,
    });
    const safeAccountList = await request('/accounts');
    const safeAccountText = await safeAccountList.text();
    expect(safeAccountList.status).toBe(200);
    expect(safeAccountText).toContain('Integration YouTube channel');
    expect(safeAccountText).not.toContain(
      'youtube-fixture-access-token-do-not-return',
    );
    expect(safeAccountText).not.toContain('credentialCiphertext');

    const emailAccount = await connect('ZOHO_CAMPAIGNS');
    const emailSync = await request(
      `/accounts/${emailAccount.id}/sync`,
      'POST',
      { from, to },
    );
    expect(emailSync.status).toBe(201);
    expect(await emailSync.json()).toMatchObject({
      accountId: emailAccount.id,
      emailCampaigns: 1,
    });
    const emailResponse = await request(
      `/accounts/${emailAccount.id}/email-report?from=${from}&to=${to}`,
    );
    expect(emailResponse.status).toBe(200);
    const emailReport = (await emailResponse.json()) as {
      totals: Record<string, number | null>;
      campaigns: Array<{ name: string }>;
      caveats: string[];
    };
    expect(emailReport.totals).toMatchObject({
      SENT: 110,
      DELIVERED: 100,
      OPEN_RATE: 29.5,
      UNIQUE_CLICK_RATE: 7.2,
    });
    expect(emailReport.campaigns).toEqual([
      expect.objectContaining({ name: 'Persisted email campaign' }),
    ]);
    expect(emailReport.caveats.join(' ')).toContain(
      'up to 400 recent sent campaigns',
    );
    const emailPdf = await request(
      `/accounts/${emailAccount.id}/email-report.pdf?from=${from}&to=${to}`,
    );
    expect(emailPdf.status).toBe(200);
    expect(
      Buffer.from(await emailPdf.arrayBuffer()).toString('ascii', 0, 5),
    ).toBe('%PDF-');

    const disconnected = await request(
      `/accounts/${emailAccount.id}`,
      'DELETE',
    );
    expect(disconnected.status).toBe(200);
    expect(await disconnected.json()).toMatchObject({
      id: emailAccount.id,
      disconnected: true,
      historicalAnalyticsRetained: true,
      providerAccessRevocation: 'revoked',
    });
    expect(revokeCredentials).toHaveBeenCalledWith(
      'ZOHO_CAMPAIGNS',
      expect.objectContaining({ refreshToken: 'fixture-refresh-token' }),
    );
    expect(
      await prisma.connectedAccount.findUnique({
        where: { id: emailAccount.id },
      }),
    ).toMatchObject({ active: false, credentialCiphertext: null });
    expect(
      await prisma.connectedAccountAnalyticsRecord.count({
        where: { connectedAccountId: emailAccount.id, scope: 'EMAIL_CAMPAIGN' },
      }),
    ).toBeGreaterThan(0);
    const retainedReport = await request(
      `/accounts/${emailAccount.id}/email-report?from=${from}&to=${to}`,
    );
    expect(retainedReport.status).toBe(200);
    expect((await retainedReport.json()).campaignCount).toBe(1);

    const deleted = await request(
      `/accounts/${emailAccount.id}/data`,
      'DELETE',
    );
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toMatchObject({
      id: emailAccount.id,
      deleted: true,
      historicalAnalyticsDeleted: true,
    });
    expect(
      await prisma.connectedAccount.findUnique({
        where: { id: emailAccount.id },
      }),
    ).toBeNull();
    expect(
      await prisma.connectedAccountAnalyticsRecord.count({
        where: { connectedAccountId: emailAccount.id },
      }),
    ).toBe(0);
  });
});
