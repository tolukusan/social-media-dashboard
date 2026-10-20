import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  AccountProviderFailure,
  type ConnectedAccountProvider,
  type EmailCampaignObservation,
  type MetricObservation,
  type OAuthCredentials,
  type PostObservation,
  type ProviderAccessRevocation,
  type ProviderSyncResult,
  validDay,
} from './account-contract.js';
import {
  decryptCredentials,
  encryptCredentials,
  hashOAuthState,
  newOAuthState,
  providerSetup,
} from './account-crypto.js';
import { AccountProviderClient } from './account-provider-client.js';
import { renderAccountReportPdf } from './account-report-pdf.js';
import { AccountAnalyticsService } from '../account-analytics/account-analytics.service.js';
import { planMetaHistory, type MetaProvider } from './account-history-plan.js';
import { accountMetricCoverage } from './account-coverage.js';

const accountPublicSelect = {
  id: true,
  provider: true,
  kind: true,
  externalAccountId: true,
  displayName: true,
  handle: true,
  profileUrl: true,
  profileMetadataExpiresAt: true,
  active: true,
  connectedAt: true,
  lastSyncedAt: true,
  lastSyncErrorCode: true,
  tokenExpiresAt: true,
  connectedByUser: { select: { id: true, name: true } },
} satisfies Prisma.ConnectedAccountSelect;

type AccountRecord = Prisma.ConnectedAccountGetPayload<{
  select: typeof accountPublicSelect;
}>;
type WorkerAccount = {
  id: string;
  provider: ConnectedAccountProvider;
  externalAccountId: string;
  active: boolean;
  credentialCiphertext: string | null;
  tokenExpiresAt: Date | null;
};
type PublicAccountInput = Pick<
  AccountRecord,
  | 'id'
  | 'provider'
  | 'kind'
  | 'externalAccountId'
  | 'displayName'
  | 'handle'
  | 'profileUrl'
  | 'profileMetadataExpiresAt'
  | 'active'
  | 'connectedAt'
  | 'lastSyncedAt'
  | 'lastSyncErrorCode'
> & {
  connectedByUser?: AccountRecord['connectedByUser'];
};

const numberValue = (value: Prisma.Decimal | number | string) => Number(value);
const unexpiredMetricValue = (at = new Date()) => ({
  OR: [{ sourceDataExpiresAt: null }, { sourceDataExpiresAt: { gt: at } }],
});
const dateValue = (value: string) =>
  new Date(`${validDay(value)}T00:00:00.000Z`);

const metricCatalog: Record<
  Exclude<ConnectedAccountProvider, 'ZOHO_CAMPAIGNS'>,
  Array<{
    code: string;
    label: string;
    unit: 'COUNT' | 'MINUTES';
    mode: 'SUM' | 'SNAPSHOT' | 'DERIVED';
  }>
> = {
  INSTAGRAM: [
    {
      code: 'AUDIENCE_SIZE',
      label: 'Followers',
      unit: 'COUNT',
      mode: 'SNAPSHOT',
    },
    {
      code: 'AUDIENCE_CHANGE',
      label: 'Follower change',
      unit: 'COUNT',
      mode: 'DERIVED',
    },
    { code: 'MEDIA_VIEWS', label: 'Views', unit: 'COUNT', mode: 'SUM' },
    {
      code: 'ACCOUNTS_REACHED',
      label: 'Accounts reached',
      unit: 'COUNT',
      mode: 'SUM',
    },
    {
      code: 'CONTENT_INTERACTIONS',
      label: 'Content interactions',
      unit: 'COUNT',
      mode: 'SUM',
    },
  ],
  FACEBOOK: [
    {
      code: 'AUDIENCE_SIZE',
      label: 'Followers',
      unit: 'COUNT',
      mode: 'SNAPSHOT',
    },
    {
      code: 'AUDIENCE_CHANGE',
      label: 'Follower change',
      unit: 'COUNT',
      mode: 'DERIVED',
    },
    {
      code: 'ORGANIC_MEDIA_VIEWS',
      label: 'Organic content views',
      unit: 'COUNT',
      mode: 'SUM',
    },
    { code: 'PAGE_VISITS', label: 'Page visits', unit: 'COUNT', mode: 'SUM' },
  ],
  LINKEDIN: [
    {
      code: 'ORGANIC_NEW_FOLLOWERS',
      label: 'New followers (organic)',
      unit: 'COUNT',
      mode: 'SUM',
    },
    { code: 'PAGE_VIEWS', label: 'Page views', unit: 'COUNT', mode: 'SUM' },
    {
      code: 'ORGANIC_POST_IMPRESSIONS',
      label: 'Post impressions (organic)',
      unit: 'COUNT',
      mode: 'SUM',
    },
    {
      code: 'ORGANIC_UNIQUE_IMPRESSIONS',
      label: 'Unique post impressions (organic)',
      unit: 'COUNT',
      mode: 'SUM',
    },
    {
      code: 'ORGANIC_POST_CLICKS',
      label: 'Post clicks (organic)',
      unit: 'COUNT',
      mode: 'SUM',
    },
  ],
  YOUTUBE: [
    {
      code: 'AUDIENCE_SIZE',
      label: 'Subscribers',
      unit: 'COUNT',
      mode: 'SNAPSHOT',
    },
    {
      code: 'SUBSCRIBER_NET_CHANGE',
      label: 'Subscriber change',
      unit: 'COUNT',
      mode: 'DERIVED',
    },
    { code: 'VIEWS', label: 'Views', unit: 'COUNT', mode: 'SUM' },
    {
      code: 'WATCH_TIME_MINUTES',
      label: 'Watch time (minutes)',
      unit: 'MINUTES',
      mode: 'SUM',
    },
    { code: 'LIKES', label: 'Likes', unit: 'COUNT', mode: 'SUM' },
  ],
};

type AccountMetricRow = {
  metricCode: string;
  scope: 'DAILY' | 'SNAPSHOT';
  metricDate: Date;
  retrievedAt: Date;
  value: Prisma.Decimal;
};

const topPostMetric: Partial<Record<ConnectedAccountProvider, string>> = {
  INSTAGRAM: 'VIEWS',
  FACEBOOK: 'ORGANIC_VIEWS',
  LINKEDIN: 'ORGANIC_POST_IMPRESSIONS',
  YOUTUBE: 'VIEWS',
};

function dayDiff(from: string, to: string) {
  return (
    Math.round(
      (dateValue(to).getTime() - dateValue(from).getTime()) / 86_400_000,
    ) + 1
  );
}

function previousRange(from: string, to: string) {
  const length = dayDiff(from, to);
  const end = new Date(dateValue(from));
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - length + 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function dayRange(start: string, end: string) {
  const days: string[] = [];
  const date = dateValue(start);
  const last = dateValue(end);
  for (let count = 0; date <= last && count < 400; count += 1) {
    days.push(date.toISOString().slice(0, 10));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return days;
}

function calculated(value: number | null, previous: number | null) {
  const difference =
    value === null || previous === null ? null : value - previous;
  const percentageChange =
    difference === null || previous === null || previous === 0
      ? null
      : Number(((difference / previous) * 100).toFixed(2));
  return { difference, percentageChange };
}

@Injectable()
export class ConnectedAccountsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private workerTimer?: ReturnType<typeof setInterval>;
  private workerTickRunning = false;
  private readonly syncing = new Set<string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccountProviderClient)
    private readonly providerClient: AccountProviderClient,
    @Inject(AccountAnalyticsService)
    private readonly accountAnalytics: AccountAnalyticsService,
  ) {}

  onModuleInit() {
    if (
      process.env.INTEGRATIONS_SCHEDULER_ENABLED === 'false' ||
      process.env.TEST_DATABASE_URL
    )
      return;
    this.timer = setInterval(
      () => {
        void this.dailyRefresh().catch(() => undefined);
      },
      60 * 60 * 1000,
    );
    this.timer.unref();
    this.workerTimer = setInterval(() => {
      void this.pollSyncJobs().catch(() => undefined);
    }, 10 * 1000);
    this.workerTimer.unref();
    void this.pollSyncJobs().catch(() => undefined);
    void this.cleanupExpiredData().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.workerTimer) clearInterval(this.workerTimer);
  }

  options() {
    return {
      providers: (
        [
          'INSTAGRAM',
          'FACEBOOK',
          'LINKEDIN',
          'YOUTUBE',
          'ZOHO_CAMPAIGNS',
        ] as const
      ).map((provider) => ({
        provider,
        ...providerSetup(provider),
        capabilities: this.capabilities(provider),
      })),
      reportingTimezone: process.env.REPORTING_TIMEZONE ?? 'Africa/Lagos',
      syncMode: 'MANUAL_AND_DAILY',
      dataTypes: {
        social:
          'Organic account and post analytics; paid ads remain in Campaigns.',
        email:
          'Cumulative sent-campaign reports; shown separately from social analytics.',
      },
    };
  }

  async list() {
    const accounts = await this.prisma.connectedAccount.findMany({
      select: accountPublicSelect,
      orderBy: [{ kind: 'asc' }, { provider: 'asc' }, { displayName: 'asc' }],
    });
    const now = new Date();
    return accounts.map((account) => this.publicAccount(account, now));
  }

  private publicAccount(account: PublicAccountInput, now = new Date()) {
    const metadataExpired = Boolean(
      account.profileMetadataExpiresAt &&
      account.profileMetadataExpiresAt < now,
    );
    return {
      id: account.id,
      provider: account.provider,
      kind: account.kind,
      externalAccountId: account.externalAccountId,
      displayName: metadataExpired
        ? `LinkedIn organization ${account.externalAccountId}`
        : account.displayName,
      handle: metadataExpired ? null : account.handle,
      profileUrl: metadataExpired ? null : account.profileUrl,
      active: account.active,
      connectedAt: account.connectedAt,
      lastSyncedAt: account.lastSyncedAt,
      lastSyncErrorCode: account.lastSyncErrorCode,
      ...(account.connectedByUser
        ? { connectedByUser: account.connectedByUser }
        : {}),
      retention: this.retentionInfo(account.provider),
    };
  }

  async startOAuth(provider: string, actorId: string) {
    if (!this.isProvider(provider))
      throw new BadRequestException({
        code: 'ACCOUNT_PROVIDER_UNSUPPORTED',
        message: 'Choose one of the supported account providers.',
      });
    const setup = providerSetup(provider);
    if (!setup.ready)
      throw new BadRequestException({
        code: 'ACCOUNT_PROVIDER_CONFIGURATION_REQUIRED',
        message: `Provider setup is incomplete. Configure: ${setup.missing.join(', ')}.`,
      });
    const redirectUri = this.redirectUri();
    const state = newOAuthState();
    await this.prisma.accountOAuthState.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    await this.prisma.accountOAuthState.create({
      data: {
        id: randomUUID(),
        provider,
        stateHash: hashOAuthState(state),
        userId: actorId,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return {
      authorizationUrl: this.providerClient.authorizationUrl(
        provider,
        state,
        redirectUri,
      ),
    };
  }

  async finishOAuth(
    state: string,
    code: string | undefined,
    providerError?: string,
  ) {
    const appOrigin = this.appOrigin();
    try {
      if (!/^[A-Za-z0-9_-]{40,100}$/.test(state))
        throw new Error('Invalid OAuth state');
      const stateHash = hashOAuthState(state);
      const attempt = await this.prisma.accountOAuthState.findUnique({
        where: { stateHash },
      });
      if (!attempt || attempt.expiresAt <= new Date() || attempt.consumedAt)
        throw new Error('Expired OAuth state');
      const claimed = await this.prisma.accountOAuthState.updateMany({
        where: {
          id: attempt.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error('Reused OAuth state');
      if (providerError)
        return this.callbackUrl(appOrigin, 'cancelled', attempt.provider);
      if (!code || code.length > 2048)
        return this.callbackUrl(appOrigin, 'failed', attempt.provider);

      const provider = attempt.provider as ConnectedAccountProvider;
      const credentials = await this.providerClient.exchangeCode(
        provider,
        code,
        this.redirectUri(),
      );
      const candidates = await this.providerClient.discover(
        provider,
        credentials,
      );
      if (!candidates.length)
        return this.callbackUrl(appOrigin, 'no-accounts', provider);
      const accountIds: string[] = [];
      for (const candidate of candidates) {
        const account = await this.prisma.connectedAccount.upsert({
          where: {
            provider_externalAccountId: {
              provider: candidate.provider,
              externalAccountId: candidate.externalAccountId,
            },
          },
          create: {
            id: randomUUID(),
            provider: candidate.provider,
            kind: candidate.kind,
            externalAccountId: candidate.externalAccountId,
            displayName: candidate.displayName,
            handle: candidate.handle,
            profileUrl: candidate.profileUrl,
            profileMetadataExpiresAt: candidate.profileMetadataExpiresAt,
            credentialCiphertext: encryptCredentials(candidate.credentials),
            tokenExpiresAt: candidate.tokenExpiresAt,
            connectedByUserId: attempt.userId,
          },
          update: {
            kind: candidate.kind,
            displayName: candidate.displayName,
            handle: candidate.handle,
            profileUrl: candidate.profileUrl,
            profileMetadataExpiresAt: candidate.profileMetadataExpiresAt,
            credentialCiphertext: encryptCredentials(candidate.credentials),
            tokenExpiresAt: candidate.tokenExpiresAt,
            connectedByUserId: attempt.userId,
            active: true,
            lastSyncErrorCode: null,
          },
          select: { id: true },
        });
        accountIds.push(account.id);
        await this.prisma.auditLog.create({
          data: {
            actorUserId: attempt.userId,
            entityType: 'ConnectedAccount',
            entityId: account.id,
            action: 'CONNECTED_ACCOUNT_AUTHORIZED',
            metadata: { provider: candidate.provider, kind: candidate.kind },
          },
        });
      }

      // Start the account journey with usable data. A missing provider
      // permission should not undo an otherwise successful OAuth connection.
      for (const accountId of accountIds) {
        try {
          const account = await this.prisma.connectedAccount.findUnique({
            where: { id: accountId },
            select: { provider: true },
          });
          if (!account) continue;
          const to = this.today();
          if (
            account.provider === 'INSTAGRAM' ||
            account.provider === 'FACEBOOK'
          ) {
            await this.enqueueMetaSync(
              accountId,
              this.shiftDay(to, -364),
              to,
              'OAUTH',
              attempt.userId,
              true,
            );
            continue;
          }
          // Seed the current and preceding 30-day periods so the dashboard
          // opens with a meaningful month-over-month comparison and content.
          const currentFrom = this.shiftDay(to, -29);
          await this.syncAccount(accountId, currentFrom, to, true);
          if (account.provider !== 'ZOHO_CAMPAIGNS') {
            const previousTo = this.shiftDay(currentFrom, -1);
            const previousFrom = this.shiftDay(previousTo, -29);
            await this.syncAccount(accountId, previousFrom, previousTo, true);
          }
        } catch (error) {
          await this.prisma.connectedAccount.updateMany({
            where: { id: accountId },
            data: { lastSyncErrorCode: this.errorCode(error) },
          });
        }
      }
      return this.callbackUrl(appOrigin, 'connected', attempt.provider);
    } catch {
      return this.callbackUrl(appOrigin, 'failed');
    }
  }

  async sync(id: string, from: string, to: string, actorId: string) {
    this.validateRange(from, to);
    const account = await this.getActiveAccount(id);
    this.validateProviderRange(account.provider, from, to);
    if (account.provider === 'INSTAGRAM' || account.provider === 'FACEBOOK') {
      const queued = await this.enqueueMetaSync(
        id,
        from,
        to,
        'MANUAL',
        actorId,
      );
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'ConnectedAccount',
          entityId: id,
          action: 'CONNECTED_ACCOUNT_SYNC_QUEUED',
          metadata: { provider: account.provider, from, to, jobId: queued.id },
        },
      });
      return { ...queued, queued: true };
    }
    const result = await this.syncAccount(id, from, to, false);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        entityType: 'ConnectedAccount',
        entityId: id,
        action: 'CONNECTED_ACCOUNT_SYNCED',
        metadata: { provider: account.provider, from, to },
      },
    });
    return {
      accountId: id,
      lastSyncedAt: new Date().toISOString(),
      observations: result.metrics.length,
      posts: result.posts.length,
      emailCampaigns: result.emailCampaigns.length,
    };
  }

  async enqueueSyncJob(id: string, from: string, to: string, actorId: string) {
    this.validateRange(from, to);
    const account = await this.getActiveAccount(id);
    if (account.provider !== 'INSTAGRAM' && account.provider !== 'FACEBOOK')
      throw new BadRequestException({
        code: 'ASYNC_SYNC_META_ONLY',
        message:
          'Background history sync is available for Instagram and Facebook accounts.',
      });
    this.validateProviderRange(account.provider, from, to);
    const queued = await this.enqueueMetaSync(id, from, to, 'MANUAL', actorId);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        entityType: 'ConnectedAccount',
        entityId: id,
        action: 'CONNECTED_ACCOUNT_SYNC_QUEUED',
        metadata: { provider: account.provider, from, to, jobId: queued.id },
      },
    });
    return {
      ...queued,
      queued: true,
    };
  }

  async activeSyncJob(id: string) {
    await this.getAccount(id);
    const job = await this.prisma.connectedAccountSyncJob.findFirst({
      where: { connectedAccountId: id, status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'desc' },
      include: { chunks: { orderBy: { sequence: 'asc' } } },
    });
    return job ? this.syncJobSummary(job, job.chunks) : null;
  }

  async syncJob(id: string, jobId: string) {
    await this.getAccount(id);
    const job = await this.prisma.connectedAccountSyncJob.findFirst({
      where: { id: jobId, connectedAccountId: id },
      include: { chunks: { orderBy: { sequence: 'asc' } } },
    });
    if (!job)
      throw new NotFoundException({
        code: 'ACCOUNT_SYNC_JOB_NOT_FOUND',
        message: 'The sync job was not found for this account.',
      });
    return this.syncJobSummary(job, job.chunks);
  }

  private async enqueueMetaSync(
    accountId: string,
    from: string,
    to: string,
    source: 'MANUAL' | 'SCHEDULED' | 'OAUTH',
    requestedByUserId: string | null,
    bootstrap = false,
  ) {
    const account = await this.getActiveAccount(accountId);
    if (account.provider !== 'INSTAGRAM' && account.provider !== 'FACEBOOK')
      throw new BadRequestException({
        code: 'META_SYNC_UNSUPPORTED',
        message: 'History sync is available only for Instagram and Facebook.',
      });
    const plan = planMetaHistory(
      account.provider as MetaProvider,
      from,
      to,
      this.today(),
    );
    const active = await this.prisma.connectedAccountSyncJob.findFirst({
      where: {
        connectedAccountId: accountId,
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      include: { chunks: { orderBy: { sequence: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (active)
      return {
        ...this.syncJobSummary(active, active.chunks),
        alreadyRunning: true,
      };

    const now = new Date();
    const id = randomUUID();
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        const created = await tx.connectedAccountSyncJob.create({
          data: {
            id,
            connectedAccountId: accountId,
            requestedFrom: dateValue(from),
            requestedTo: dateValue(to),
            fetchFrom: plan.fetchFrom ? dateValue(plan.fetchFrom) : null,
            fetchTo: plan.fetchTo ? dateValue(plan.fetchTo) : null,
            source,
            requestedByUserId,
            status: plan.chunks.length ? 'QUEUED' : 'SUCCEEDED',
            completedAt: plan.chunks.length ? null : now,
          },
        });
        if (plan.chunks.length)
          await tx.connectedAccountSyncChunk.createMany({
            data: plan.chunks.map((chunk) => ({
              id: randomUUID(),
              jobId: id,
              fromDate: dateValue(chunk.from),
              toDate: dateValue(chunk.to),
              sequence: chunk.sequence,
            })),
          });
        if (bootstrap)
          await tx.connectedAccount.updateMany({
            where: { id: accountId, historyBootstrapEnqueuedAt: null },
            data: { historyBootstrapEnqueuedAt: now },
          });
        return created;
      });
      return {
        ...this.syncJobSummary(
          job,
          plan.chunks.map((chunk) => ({
            status: 'QUEUED',
            attemptCount: 0,
            observationCount: 0,
            errorCode: null,
            fromDate: dateValue(chunk.from),
            toDate: dateValue(chunk.to),
            sequence: chunk.sequence,
          })),
        ),
        alreadyRunning: false,
      };
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      const winner = await this.prisma.connectedAccountSyncJob.findFirst({
        where: {
          connectedAccountId: accountId,
          status: { in: ['QUEUED', 'RUNNING'] },
        },
        include: { chunks: { orderBy: { sequence: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
      if (!winner) throw error;
      return {
        ...this.syncJobSummary(winner, winner.chunks),
        alreadyRunning: true,
      };
    }
  }

  private syncJobSummary(
    job: {
      id: string;
      status: string;
      source: string;
      requestedFrom: Date;
      requestedTo: Date;
      fetchFrom: Date | null;
      fetchTo: Date | null;
      createdAt: Date;
      startedAt: Date | null;
      updatedAt: Date;
      completedAt: Date | null;
      finalErrorCode: string | null;
    },
    chunks: Array<{
      status: string;
      attemptCount: number;
      observationCount: number;
      errorCode: string | null;
      fromDate: Date;
      toDate: Date;
      sequence: number;
    }> = [],
  ) {
    const completedChunks = chunks.filter(
      (chunk) =>
        chunk.status === 'SUCCEEDED' ||
        (chunk.status === 'FAILED' &&
          (chunk.attemptCount >= 4 ||
            !this.retryableSyncError(chunk.errorCode ?? ''))),
    ).length;
    return {
      id: job.id,
      source: job.source,
      status: job.status,
      requestedPeriod: {
        from: job.requestedFrom.toISOString().slice(0, 10),
        to: job.requestedTo.toISOString().slice(0, 10),
      },
      fetchablePeriod:
        job.fetchFrom && job.fetchTo
          ? {
              from: job.fetchFrom.toISOString().slice(0, 10),
              to: job.fetchTo.toISOString().slice(0, 10),
            }
          : null,
      completedChunks,
      totalChunks: chunks.length,
      successfulChunks: chunks.filter((chunk) => chunk.status === 'SUCCEEDED')
        .length,
      failedChunks: chunks.filter((chunk) => chunk.status === 'FAILED').length,
      observationCount: chunks.reduce(
        (sum, chunk) => sum + chunk.observationCount,
        0,
      ),
      errors: chunks
        .filter((chunk) => chunk.status === 'FAILED' && chunk.errorCode)
        .map((chunk) => ({
          code: chunk.errorCode,
          from: chunk.fromDate.toISOString().slice(0, 10),
          to: chunk.toDate.toISOString().slice(0, 10),
          attempts: chunk.attemptCount,
        })),
      finalErrorCode: job.finalErrorCode,
      createdAt: job.createdAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      updatedAt: job.updatedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    };
  }

  private async pollSyncJobs() {
    if (
      this.workerTickRunning ||
      process.env.INTEGRATIONS_SCHEDULER_ENABLED === 'false' ||
      process.env.TEST_DATABASE_URL
    )
      return;
    this.workerTickRunning = true;
    try {
      const claimed = await Promise.all([
        this.claimSyncJob(),
        this.claimSyncJob(),
      ]);
      await Promise.all(
        claimed
          .filter((job): job is { id: string; leaseToken: string } =>
            Boolean(job),
          )
          .map((job) => this.processSyncJob(job.id, job.leaseToken)),
      );
    } finally {
      this.workerTickRunning = false;
    }
  }

  private async claimSyncJob(): Promise<{
    id: string;
    leaseToken: string;
  } | null> {
    const now = new Date();
    const candidates = await this.prisma.connectedAccountSyncJob.findMany({
      where: {
        connectedAccount: { is: { active: true } },
        chunks: {
          some: {
            OR: [
              { status: 'QUEUED' },
              { status: 'FAILED', nextAttemptAt: { lte: now } },
              {
                status: 'RUNNING',
                updatedAt: { lte: new Date(now.getTime() - 5 * 60_000) },
              },
            ],
          },
        },
        OR: [
          { status: 'QUEUED' },
          { status: 'RUNNING', leaseUntil: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      select: { id: true, status: true, leaseUntil: true },
    });
    for (const candidate of candidates) {
      const leaseToken = randomUUID();
      const claim = await this.prisma.connectedAccountSyncJob.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          ...(candidate.status === 'RUNNING'
            ? { leaseUntil: { lte: now } }
            : {}),
        },
        data: {
          status: 'RUNNING',
          leaseToken,
          leaseUntil: new Date(now.getTime() + 5 * 60_000),
        },
      });
      if (claim.count !== 1) continue;
      if (candidate.status === 'RUNNING')
        await this.prisma.connectedAccountSyncChunk.updateMany({
          where: { jobId: candidate.id, status: 'RUNNING' },
          data: { status: 'QUEUED' },
        });
      await this.prisma.connectedAccountSyncJob.updateMany({
        where: { id: candidate.id, leaseToken, startedAt: null },
        data: { startedAt: now },
      });
      return { id: candidate.id, leaseToken };
    }
    return null;
  }

  private async processSyncJob(jobId: string, leaseToken: string) {
    const heartbeat = setInterval(() => {
      void this.prisma.connectedAccountSyncJob
        .updateMany({
          where: { id: jobId, status: 'RUNNING', leaseToken },
          data: { leaseUntil: new Date(Date.now() + 5 * 60_000) },
        })
        .catch(() => undefined);
    }, 30_000);
    heartbeat.unref();
    try {
      const job = await this.prisma.connectedAccountSyncJob.findUnique({
        where: { id: jobId },
        include: { connectedAccount: true },
      });
      if (
        !job ||
        job.status !== 'RUNNING' ||
        job.leaseToken !== leaseToken ||
        !job.connectedAccount.active
      )
        return;
      if (
        job.connectedAccount.provider !== 'INSTAGRAM' &&
        job.connectedAccount.provider !== 'FACEBOOK'
      )
        throw new AccountProviderFailure(
          'META_SYNC_UNSUPPORTED',
          'This job is not a Meta history job.',
        );

      if (!job.snapshotRecordedAt)
        await this.captureJobAudienceSnapshot(
          job.id,
          leaseToken,
          job.connectedAccount,
        );
      if (!job.contentRefreshRecordedAt)
        await this.captureJobRecentContent(
          job.id,
          leaseToken,
          job.connectedAccount,
        );

      const now = new Date();
      const chunk = await this.prisma.connectedAccountSyncChunk.findFirst({
        where: {
          jobId,
          OR: [
            { status: 'QUEUED' },
            { status: 'FAILED', nextAttemptAt: { lte: now } },
          ],
        },
        orderBy: { sequence: 'asc' },
      });
      if (!chunk) {
        await this.finishSyncJob(jobId, leaseToken);
        return;
      }
      const started = await this.prisma.$transaction(async (tx) => {
        await this.jobWriteGuard(job.connectedAccountId, jobId, leaseToken)(tx);
        return tx.connectedAccountSyncChunk.update({
          where: { id: chunk.id },
          data: {
            status: 'RUNNING',
            attemptCount: { increment: 1 },
            errorCode: null,
          },
        });
      });
      const credentials = await this.workerCredentials(job.connectedAccount);
      const from = chunk.fromDate.toISOString().slice(0, 10);
      const to = chunk.toDate.toISOString().slice(0, 10);
      const metrics = await this.providerClient.syncMetaAccountMetrics(
        {
          provider: job.connectedAccount.provider,
          externalAccountId: job.connectedAccount.externalAccountId,
        },
        credentials,
        from,
        to,
      );
      await this.saveSync(
        job.connectedAccountId,
        job.connectedAccount.provider,
        { metrics, posts: [], emailCampaigns: [], caveats: [] },
        from,
        to,
        this.jobWriteGuard(job.connectedAccountId, jobId, leaseToken),
      );
      await this.completeSyncChunk(job, leaseToken, chunk.id, {
        success: true,
        observationCount: metrics.length,
      });
    } catch (error) {
      if (
        error instanceof AccountProviderFailure &&
        error.code === 'SYNC_JOB_LEASE_LOST'
      )
        return;
      const code = this.errorCode(error);
      const current = await this.prisma.connectedAccountSyncJob.findFirst({
        where: { id: jobId, status: 'RUNNING', leaseToken },
        include: { chunks: { where: { status: 'RUNNING' }, take: 1 } },
      });
      const runningChunk = current?.chunks[0];
      if (runningChunk)
        await this.completeSyncChunk(current, leaseToken, runningChunk.id, {
          success: false,
          errorCode: code,
          retryAfterMs:
            error instanceof AccountProviderFailure
              ? error.retryAfterMs
              : undefined,
        }).catch(() => undefined);
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async captureJobAudienceSnapshot(
    jobId: string,
    leaseToken: string,
    account: WorkerAccount,
  ) {
    try {
      const credentials = await this.workerCredentials(account);
      const snapshot = await this.providerClient.fetchMetaAudienceSnapshot(
        {
          provider: account.provider as MetaProvider,
          externalAccountId: account.externalAccountId,
        },
        credentials,
        this.today(),
      );
      if (snapshot)
        await this.saveSync(
          account.id,
          account.provider,
          { metrics: [snapshot], posts: [], emailCampaigns: [], caveats: [] },
          snapshot.date,
          snapshot.date,
          this.jobWriteGuard(account.id, jobId, leaseToken),
        );
    } catch (error) {
      if (
        error instanceof AccountProviderFailure &&
        error.code === 'SYNC_JOB_LEASE_LOST'
      )
        throw error;
      // A missing audience snapshot does not block daily history metrics. Its
      // absence remains visible in the report's snapshot coverage metadata.
    }
    await this.prisma.$transaction(async (tx) => {
      await this.jobWriteGuard(account.id, jobId, leaseToken)(tx);
      await tx.connectedAccountSyncJob.update({
        where: { id: jobId },
        data: { snapshotRecordedAt: new Date() },
      });
    });
  }

  private async workerCredentials(account: WorkerAccount) {
    if (!account.active || !account.credentialCiphertext)
      throw new AccountProviderFailure(
        'ACCOUNT_CREDENTIALS_MISSING',
        'Reconnect this account before syncing.',
      );
    let credentials = decryptCredentials(account.credentialCiphertext);
    if (
      credentials.expiresAt &&
      Date.parse(credentials.expiresAt) <= Date.now() + 2 * 60_000
    ) {
      credentials = await this.providerClient.refreshCredentials(
        account.provider,
        credentials,
      );
      await this.prisma.connectedAccount.updateMany({
        where: { id: account.id, active: true },
        data: {
          credentialCiphertext: encryptCredentials(credentials),
          tokenExpiresAt: credentials.expiresAt
            ? new Date(credentials.expiresAt)
            : null,
        },
      });
    }
    return credentials;
  }

  private async captureJobRecentContent(
    jobId: string,
    leaseToken: string,
    account: WorkerAccount,
  ) {
    try {
      const credentials = await this.workerCredentials(account);
      const to = this.today();
      const from = this.shiftDay(to, -29);
      const posts = await this.providerClient.syncMetaRecentContent(
        {
          provider: account.provider as MetaProvider,
          externalAccountId: account.externalAccountId,
        },
        credentials,
        from,
        to,
      );
      await this.saveSync(
        account.id,
        account.provider,
        { metrics: [], posts, emailCampaigns: [], caveats: [] },
        from,
        to,
        this.jobWriteGuard(account.id, jobId, leaseToken),
      );
    } catch (error) {
      if (
        error instanceof AccountProviderFailure &&
        error.code === 'SYNC_JOB_LEASE_LOST'
      )
        throw error;
      // Recent post refresh is deliberately bounded and independent of the
      // account-metric backfill; unavailable post insights do not block it.
    }
    await this.prisma.$transaction(async (tx) => {
      await this.jobWriteGuard(account.id, jobId, leaseToken)(tx);
      await tx.connectedAccountSyncJob.update({
        where: { id: jobId },
        data: { contentRefreshRecordedAt: new Date() },
      });
    });
  }

  private jobWriteGuard(accountId: string, jobId: string, leaseToken: string) {
    return async (tx: Prisma.TransactionClient) => {
      const accounts = await tx.$queryRaw<Array<{ active: boolean }>>`
        SELECT "active"
        FROM "social_media_dashboard"."ConnectedAccount"
        WHERE "id" = ${accountId}::uuid
        FOR UPDATE
      `;
      const jobs = await tx.$queryRaw<
        Array<{ status: string; leaseToken: string | null }>
      >`
        SELECT "status", "leaseToken"
        FROM "social_media_dashboard"."ConnectedAccountSyncJob"
        WHERE "id" = ${jobId}::uuid
        FOR UPDATE
      `;
      if (
        !accounts[0]?.active ||
        jobs[0]?.status !== 'RUNNING' ||
        jobs[0]?.leaseToken !== leaseToken
      )
        throw new AccountProviderFailure(
          'SYNC_JOB_LEASE_LOST',
          'This sync job is no longer active.',
        );
    };
  }

  private async completeSyncChunk(
    job: { id: string; connectedAccountId: string },
    leaseToken: string,
    chunkId: string,
    outcome:
      | { success: true; observationCount: number }
      | { success: false; errorCode: string; retryAfterMs?: number },
  ) {
    const now = new Date();
    const attempt = outcome.success
      ? null
      : await this.prisma.connectedAccountSyncChunk.findUnique({
          where: { id: chunkId },
          select: { attemptCount: true },
        });
    const retries = [60_000, 5 * 60_000, 15 * 60_000];
    const retryDelay =
      !outcome.success &&
      this.retryableSyncError(outcome.errorCode) &&
      (attempt?.attemptCount ?? 4) <= retries.length
        ? Math.max(
            retries[(attempt?.attemptCount ?? 4) - 1] ?? 0,
            outcome.retryAfterMs ?? 0,
          )
        : null;
    await this.prisma.$transaction(async (tx) => {
      await this.jobWriteGuard(job.connectedAccountId, job.id, leaseToken)(tx);
      await tx.connectedAccountSyncChunk.update({
        where: { id: chunkId },
        data: outcome.success
          ? {
              status: 'SUCCEEDED',
              observationCount: outcome.observationCount,
              errorCode: null,
            }
          : {
              status: 'FAILED',
              errorCode: outcome.errorCode,
              nextAttemptAt: retryDelay
                ? new Date(now.getTime() + retryDelay)
                : new Date('9999-12-31T00:00:00.000Z'),
            },
      });
      const chunks = await tx.connectedAccountSyncChunk.findMany({
        where: { jobId: job.id },
        select: {
          status: true,
          errorCode: true,
          attemptCount: true,
          nextAttemptAt: true,
        },
      });
      const hasQueued = chunks.some((item) => item.status === 'QUEUED');
      const hasRunning = chunks.some((item) => item.status === 'RUNNING');
      const hasRetry = chunks.some(
        (item) =>
          item.status === 'FAILED' &&
          item.attemptCount < 4 &&
          this.retryableSyncError(item.errorCode ?? '') &&
          item.nextAttemptAt.getTime() <
            new Date('9999-12-31T00:00:00.000Z').getTime(),
      );
      const finished = !hasQueued && !hasRunning && !hasRetry;
      const successful = chunks.filter(
        (item) => item.status === 'SUCCEEDED',
      ).length;
      const failed = chunks.filter((item) => item.status === 'FAILED').length;
      const status = !finished
        ? 'QUEUED'
        : failed === 0
          ? 'SUCCEEDED'
          : successful > 0
            ? 'PARTIAL'
            : 'FAILED';
      await tx.connectedAccountSyncJob.update({
        where: { id: job.id },
        data: {
          status,
          leaseToken: null,
          leaseUntil: null,
          completedAt: finished ? now : null,
          finalErrorCode:
            finished && failed
              ? outcome.success
                ? (chunks.find((item) => item.status === 'FAILED')?.errorCode ??
                  null)
                : outcome.errorCode
              : null,
        },
      });
      if (outcome.success)
        await tx.connectedAccount.updateMany({
          where: { id: job.connectedAccountId, active: true },
          data: { lastSyncedAt: now, lastSyncErrorCode: null },
        });
      else if (finished)
        await tx.connectedAccount.updateMany({
          where: { id: job.connectedAccountId, active: true },
          data: { lastSyncErrorCode: outcome.errorCode },
        });
    });
  }

  private async finishSyncJob(jobId: string, leaseToken: string) {
    const job = await this.prisma.connectedAccountSyncJob.findUnique({
      where: { id: jobId },
      select: { connectedAccountId: true },
    });
    if (!job) return;
    await this.prisma.$transaction(async (tx) => {
      await this.jobWriteGuard(job.connectedAccountId, jobId, leaseToken)(tx);
      const chunks = await tx.connectedAccountSyncChunk.findMany({
        where: { jobId },
        select: { status: true, errorCode: true },
      });
      const failed = chunks.filter((chunk) => chunk.status === 'FAILED');
      const succeeded = chunks.filter((chunk) => chunk.status === 'SUCCEEDED');
      const status = failed.length
        ? succeeded.length
          ? 'PARTIAL'
          : 'FAILED'
        : 'SUCCEEDED';
      await tx.connectedAccountSyncJob.update({
        where: { id: jobId },
        data: {
          status,
          leaseToken: null,
          leaseUntil: null,
          completedAt: new Date(),
          finalErrorCode: failed[0]?.errorCode ?? null,
        },
      });
    });
  }

  private retryableSyncError(code: string) {
    return ['PROVIDER_RATE_LIMITED', 'PROVIDER_UNAVAILABLE'].includes(code);
  }

  private async syncAccount(
    id: string,
    from: string,
    to: string,
    allowBusy: boolean,
  ) {
    if (this.syncing.has(id)) {
      if (allowBusy)
        return { metrics: [], posts: [], emailCampaigns: [], caveats: [] };
      throw new ConflictException({
        code: 'ACCOUNT_SYNC_RUNNING',
        message: 'A sync is already running for this account.',
      });
    }
    this.syncing.add(id);
    try {
      const account = await this.prisma.connectedAccount.findUnique({
        where: { id },
      });
      if (!account || !account.active)
        throw new NotFoundException({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Connected account not found or disconnected.',
        });
      if (!account.credentialCiphertext)
        throw new AccountProviderFailure(
          'ACCOUNT_CREDENTIALS_MISSING',
          'Reconnect this account before syncing.',
        );
      let credentials = decryptCredentials(account.credentialCiphertext);
      if (
        credentials.expiresAt &&
        Date.parse(credentials.expiresAt) <= Date.now() + 2 * 60 * 1000
      ) {
        credentials = await this.providerClient.refreshCredentials(
          account.provider,
          credentials,
        );
        await this.prisma.connectedAccount.update({
          where: { id },
          data: {
            credentialCiphertext: encryptCredentials(credentials),
            tokenExpiresAt: credentials.expiresAt
              ? new Date(credentials.expiresAt)
              : null,
          },
        });
      }
      const result = await this.providerClient.sync(
        account,
        credentials,
        from,
        to,
        this.today(),
      );
      await this.saveSync(account.id, account.provider, result, from, to);
      await this.prisma.connectedAccount.update({
        where: { id },
        data: { lastSyncedAt: new Date(), lastSyncErrorCode: null },
      });
      return result;
    } catch (error) {
      await this.prisma.connectedAccount.updateMany({
        where: { id },
        data: { lastSyncErrorCode: this.errorCode(error) },
      });
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof NotFoundException
      )
        throw error;
      throw new BadRequestException({
        code: this.errorCode(error),
        message:
          error instanceof AccountProviderFailure
            ? error.message
            : 'The account could not be synced. Check provider access and try again.',
      });
    } finally {
      this.syncing.delete(id);
    }
  }

  private async saveSync(
    accountId: string,
    provider: ConnectedAccountProvider,
    result: ProviderSyncResult,
    from: string,
    to: string,
    writeGuard?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    const observations = new Map<
      string,
      {
        date: string;
        scope: 'ACCOUNT';
        sourceObjectId: 'ACCOUNT';
        sourceObservationKey: string;
        values: Record<string, number>;
      }
    >();
    for (const metric of result.metrics) {
      const isSnapshot = metric.scope === 'SNAPSHOT';
      const observationKey = `${metric.scope}:${metric.date}`;
      const observation = observations.get(observationKey) ?? {
        date: metric.date,
        scope: 'ACCOUNT' as const,
        sourceObjectId: 'ACCOUNT' as const,
        sourceObservationKey: isSnapshot
          ? `account-snapshot:${metric.date}`
          : `account:${metric.date}`,
        values: {},
      };
      observation.values[metric.code] = metric.value;
      observations.set(observationKey, observation);
    }
    const accountObservations = [...observations.values()];
    const contentObservations = result.posts.map((post) => ({
      date: to,
      scope: 'CONTENT' as const,
      sourceObjectId: post.externalPostId,
      sourceObservationKey: `content:${post.externalPostId}:${from}:${to}`,
      objectTitle: post.title,
      objectType: post.postType,
      objectUrl: post.permalink,
      objectOccurredAt: post.publishedAt ? new Date(post.publishedAt) : null,
      periodFrom: from,
      periodTo: to,
      dataScope: post.dataScope,
      values: post.metricValues,
    }));
    const campaignObservations = result.emailCampaigns.map((campaign) => ({
      date: campaign.sentAt ? campaign.sentAt.slice(0, 10) : to,
      scope: 'EMAIL_CAMPAIGN' as const,
      sourceObjectId: campaign.externalCampaignId,
      sourceObservationKey: `email:${campaign.externalCampaignId}`,
      objectTitle: campaign.campaignName,
      objectType: 'EMAIL CAMPAIGN',
      objectOccurredAt: campaign.sentAt ? new Date(campaign.sentAt) : null,
      dataScope: 'CUMULATIVE' as const,
      values: campaign.metricValues,
    }));
    await this.accountAnalytics.ingestConnectedAccount(
      accountId,
      provider,
      [...accountObservations, ...contentObservations, ...campaignObservations],
      this.providerClient.sourceApiVersion(provider),
      undefined,
      writeGuard,
    );
  }

  async analytics(id: string, from: string, to: string) {
    this.validateRange(from, to);
    const account = await this.getAccount(id);
    if (account.kind !== 'SOCIAL')
      throw new BadRequestException({
        code: 'SOCIAL_ANALYTICS_NOT_AVAILABLE',
        message:
          'Choose a social account to view this dashboard. Zoho data is in Email reports.',
      });
    this.validateProviderRange(account.provider, from, to);
    const previous = previousRange(from, to);
    const [
      rows,
      previousRows,
      posts,
      previousSnapshotRow,
      startSnapshot,
      latestHistoryJob,
    ] = await Promise.all([
      this.accountMetricRows(id, from, to),
      this.accountMetricRows(id, previous.from, previous.to),
      this.contentObservations(id, from, to),
      this.latestAudienceSnapshot(id, this.shiftDay(previous.to, 1)),
      this.latestAudienceSnapshot(id, from),
      this.prisma.connectedAccountSyncJob?.findFirst
        ? this.prisma.connectedAccountSyncJob.findFirst({
            where: {
              connectedAccountId: id,
              status: { in: ['SUCCEEDED', 'PARTIAL'] },
              completedAt: { not: null },
            },
            orderBy: { completedAt: 'desc' },
            select: { completedAt: true },
          })
        : Promise.resolve(null),
    ]);
    const currentSnapshotRow = this.latestSnapshotRow(
      rows,
      'AUDIENCE_SIZE',
      to,
    );
    const currentSnapshot = currentSnapshotRow
      ? numberValue(currentSnapshotRow.value)
      : null;
    const previousSnapshot = previousSnapshotRow
      ? numberValue(previousSnapshotRow.value)
      : null;
    const catalog =
      metricCatalog[
        account.provider as Exclude<ConnectedAccountProvider, 'ZOHO_CAMPAIGNS'>
      ];
    const currentTotals = this.totals(rows);
    const previousTotals = this.totals(previousRows);
    const boundarySnapshotsMatch = Boolean(
      startSnapshot &&
      startSnapshot.metricDate.toISOString().slice(0, 10) ===
        this.shiftDay(from, -1) &&
      currentSnapshotRow?.metricDate.toISOString().slice(0, 10) === to,
    );
    const audienceDelta = boundarySnapshotsMatch
      ? this.audienceDelta(
          account.provider,
          rows,
          startSnapshot ? numberValue(startSnapshot.value) : null,
          currentSnapshot,
        )
      : account.provider === 'LINKEDIN' || account.provider === 'YOUTUBE'
        ? this.audienceDelta(
            account.provider,
            rows,
            startSnapshot ? numberValue(startSnapshot.value) : null,
            currentSnapshot,
          )
        : null;
    const previousAudienceDelta = await this.previousAudienceDelta(
      account.provider,
      id,
      previous,
    );
    const metrics = catalog.map((definition) => {
      const current = this.metricValue(
        definition.code,
        definition.mode,
        currentTotals,
        currentSnapshot,
        audienceDelta,
      );
      const old = this.metricValue(
        definition.code,
        definition.mode,
        previousTotals,
        previousSnapshot,
        previousAudienceDelta,
      );
      const coverage =
        definition.mode === 'SUM'
          ? accountMetricCoverage(
              rows
                .filter(
                  (row) =>
                    row.metricCode === definition.code && row.scope === 'DAILY',
                )
                .map((row) => ({
                  date: row.metricDate.toISOString().slice(0, 10),
                  value: numberValue(row.value),
                })),
              from,
              to,
            )
          : {
              status:
                current !== null ? ('COMPLETE' as const) : ('NONE' as const),
              requestedDays: null,
              observedDays: null,
              firstObservedDate:
                definition.code === 'AUDIENCE_SIZE' && currentSnapshotRow
                  ? currentSnapshotRow.metricDate.toISOString().slice(0, 10)
                  : null,
              lastObservedDate:
                definition.code === 'AUDIENCE_SIZE' && currentSnapshotRow
                  ? currentSnapshotRow.metricDate.toISOString().slice(0, 10)
                  : null,
              snapshotDate:
                definition.code === 'AUDIENCE_SIZE' && currentSnapshotRow
                  ? currentSnapshotRow.metricDate.toISOString().slice(0, 10)
                  : null,
            };
      const previousCoverage =
        definition.mode === 'SUM'
          ? accountMetricCoverage(
              previousRows
                .filter(
                  (row) =>
                    row.metricCode === definition.code && row.scope === 'DAILY',
                )
                .map((row) => ({
                  date: row.metricDate.toISOString().slice(0, 10),
                  value: numberValue(row.value),
                })),
              previous.from,
              previous.to,
            )
          : {
              status: old !== null ? ('COMPLETE' as const) : ('NONE' as const),
            };
      const comparisonAllowed =
        definition.mode === 'SUM'
          ? coverage.status === 'COMPLETE' &&
            previousCoverage.status === 'COMPLETE'
          : current !== null && old !== null;
      const change = calculated(current, old);
      return {
        ...definition,
        value: current,
        previous: old,
        difference: comparisonAllowed ? change.difference : null,
        percentageChange: comparisonAllowed ? change.percentageChange : null,
        coverage,
        previousCoverage,
      };
    });
    const audienceSnapshots = rows
      .filter(
        (row) => row.scope === 'SNAPSHOT' && row.metricCode === 'AUDIENCE_SIZE',
      )
      .sort((a, b) => a.metricDate.getTime() - b.metricDate.getTime());
    const priorAudience = startSnapshot
      ? numberValue(startSnapshot.value)
      : null;
    let priorAudienceDate =
      startSnapshot?.metricDate.toISOString().slice(0, 10) ?? null;
    let previousAudience = priorAudience;
    let snapshotIndex = 0;
    const series = dayRange(from, to).map((date) => {
      const values: Record<string, number | null> = {};
      for (const definition of catalog) {
        if (definition.mode !== 'SUM') continue;
        const matching = rows.filter(
          (row) =>
            row.metricDate.toISOString().slice(0, 10) === date &&
            row.metricCode === definition.code,
        );
        values[definition.code] = matching.length
          ? matching.reduce((sum, row) => sum + numberValue(row.value), 0)
          : null;
      }
      if (account.provider === 'LINKEDIN') {
        const gains = rows.find(
          (row) =>
            row.metricDate.toISOString().slice(0, 10) === date &&
            row.metricCode === 'ORGANIC_NEW_FOLLOWERS',
        );
        values.AUDIENCE_CHANGE = gains ? numberValue(gains.value) : null;
      } else if (account.provider === 'YOUTUBE') {
        const gained = rows.find(
          (row) =>
            row.metricDate.toISOString().slice(0, 10) === date &&
            row.metricCode === 'SUBSCRIBERS_GAINED',
        );
        const lost = rows.find(
          (row) =>
            row.metricDate.toISOString().slice(0, 10) === date &&
            row.metricCode === 'SUBSCRIBERS_LOST',
        );
        values.AUDIENCE_CHANGE =
          gained && lost
            ? numberValue(gained.value) - numberValue(lost.value)
            : null;
      } else {
        while (
          snapshotIndex < audienceSnapshots.length &&
          audienceSnapshots[snapshotIndex].metricDate
            .toISOString()
            .slice(0, 10) <= date
        ) {
          const current = numberValue(audienceSnapshots[snapshotIndex].value);
          if (
            audienceSnapshots[snapshotIndex].metricDate
              .toISOString()
              .slice(0, 10) === date &&
            previousAudience !== null &&
            priorAudienceDate === this.shiftDay(date, -1)
          )
            values.AUDIENCE_CHANGE = current - previousAudience;
          previousAudience = current;
          priorAudienceDate = audienceSnapshots[snapshotIndex].metricDate
            .toISOString()
            .slice(0, 10);
          snapshotIndex += 1;
        }
        if (values.AUDIENCE_CHANGE === undefined) values.AUDIENCE_CHANGE = null;
      }
      return { date, values };
    });
    const postMetric = topPostMetric[account.provider];
    const topPosts = postMetric
      ? posts
          .map((post) => {
            const metrics = post.metricValues as Record<string, unknown>;
            const value = metrics[postMetric];
            return {
              externalPostId: post.sourceObjectId,
              title: post.objectTitle,
              postType: post.objectType,
              permalink: post.objectUrl,
              publishedAt: post.objectOccurredAt,
              dataScope: post.dataScope ?? 'LIFETIME',
              metricCode: postMetric,
              metricValue:
                typeof value === 'number' && Number.isFinite(value)
                  ? value
                  : null,
            };
          })
          .filter((post) => post.metricValue !== null)
          .sort((a, b) => (b.metricValue ?? 0) - (a.metricValue ?? 0))
          .slice(0, 10)
      : [];
    const now = new Date();
    return {
      account: this.publicAccount(account, now),
      period: { from, to },
      previousPeriod: previous,
      metrics,
      series,
      topPosts,
      coverage: {
        requestedDays: dayDiff(from, to),
        latestSuccessfulHistoryFetchAt:
          latestHistoryJob?.completedAt?.toISOString() ?? null,
        postSnapshotRetentionDays:
          account.provider === 'INSTAGRAM' || account.provider === 'FACEBOOK'
            ? 90
            : null,
      },
      caveats: this.caveats(account.provider),
      dataAvailableThrough: account.lastSyncedAt,
      generatedAt: now.toISOString(),
    };
  }

  async emailReport(id: string, from: string, to: string) {
    this.validateRange(from, to);
    const account = await this.getAccount(id);
    if (account.provider !== 'ZOHO_CAMPAIGNS' || account.kind !== 'EMAIL')
      throw new BadRequestException({
        code: 'EMAIL_REPORT_NOT_AVAILABLE',
        message: 'Choose the Zoho Campaigns account to view email reports.',
      });
    const records = await this.prisma.connectedAccountAnalyticsRecord.findMany({
      where: {
        connectedAccountId: id,
        scope: 'EMAIL_CAMPAIGN',
        objectOccurredAt: { gte: dateValue(from), lt: this.nextDayDate(to) },
        metricValues: { some: unexpiredMetricValue() },
      },
      include: {
        metricValues: {
          where: unexpiredMetricValue(),
          include: { metricDefinition: true },
        },
      },
      orderBy: [{ objectOccurredAt: 'desc' }, { objectTitle: 'asc' }],
    });
    const campaigns = records.map((record) => ({
      externalCampaignId: record.sourceObjectId,
      campaignName: record.objectTitle ?? record.sourceObjectId,
      sentAt: record.objectOccurredAt,
      observedAt: record.retrievedAt,
      metricValues: Object.fromEntries(
        record.metricValues.map((value) => [
          value.metricDefinition.code,
          Number(value.value),
        ]),
      ),
      metricDefinitions: Object.fromEntries(
        record.metricValues.map((value) => [
          value.metricDefinition.code,
          {
            aggregationStrategy: value.metricDefinition.aggregationStrategy,
            weightingMetricCode: value.metricDefinition.weightingMetricCode,
          },
        ]),
      ),
    }));
    const totalCodes = [
      'SENT',
      'DELIVERED',
      'OPENS',
      'UNIQUE_CLICKS',
      'BOUNCES',
      'UNSUBSCRIBES',
      'OPEN_RATE',
      'UNIQUE_CLICK_RATE',
    ];
    const totals: Record<string, number | null> = Object.fromEntries(
      totalCodes.map((code) => [code, null]),
    );
    for (const code of totalCodes) {
      const strategy = campaigns
        .map(
          (campaign) => campaign.metricDefinitions[code]?.aggregationStrategy,
        )
        .find(Boolean);
      if (strategy === 'SUM') {
        let sum = 0;
        let found = false;
        for (const campaign of campaigns) {
          const value = campaign.metricValues[code];
          if (typeof value === 'number' && Number.isFinite(value)) {
            sum += value;
            found = true;
          }
        }
        totals[code] = found ? sum : null;
      } else if (strategy === 'WEIGHTED_AVERAGE') {
        const weightingMetricCode = campaigns
          .map(
            (campaign) => campaign.metricDefinitions[code]?.weightingMetricCode,
          )
          .find(Boolean);
        let weightedRate = 0;
        let totalWeight = 0;
        for (const campaign of campaigns) {
          const value = campaign.metricValues[code];
          const weight = weightingMetricCode
            ? campaign.metricValues[weightingMetricCode]
            : null;
          if (
            typeof value === 'number' &&
            Number.isFinite(value) &&
            typeof weight === 'number' &&
            Number.isFinite(weight) &&
            weight > 0
          ) {
            weightedRate += value * weight;
            totalWeight += weight;
          }
        }
        totals[code] =
          totalWeight > 0
            ? Number((weightedRate / totalWeight).toFixed(2))
            : null;
      }
    }
    return {
      account: this.publicAccount(account),
      period: { from, to },
      generatedAt: new Date().toISOString(),
      campaignCount: campaigns.length,
      totals,
      campaigns: campaigns.map((campaign) => ({
        externalCampaignId: campaign.externalCampaignId,
        name: campaign.campaignName,
        sentAt: campaign.sentAt,
        observedAt: campaign.observedAt,
        metricValues: campaign.metricValues,
      })),
      caveats: [
        'Zoho Campaigns returns cumulative report totals per email campaign. The date filter selects campaigns by sent date; it does not turn cumulative totals into daily activity.',
        'Open rate and unique click rate are Zoho-reported percentages (unique opens or unique clicks divided by delivered emails). Summary rates are weighted by each campaign’s delivered count; campaigns without a rate or delivered count are excluded from that rate summary. A missing provider metric remains unavailable rather than being shown as zero.',
        'This sync scans up to 400 recent sent campaigns and fetches at most 400 campaign reports per run. Older matching campaigns may not be included.',
      ],
    };
  }

  async reportPdf(id: string, from: string, to: string) {
    const report = await this.analytics(id, from, to);
    return renderAccountReportPdf(report);
  }

  async emailReportPdf(id: string, from: string, to: string) {
    const report = await this.emailReport(id, from, to);
    return renderAccountReportPdf({
      account: report.account,
      period: report.period,
      previousPeriod: null,
      metrics: Object.entries(report.totals).map(([code, value]) => ({
        code,
        label:
          code === 'OPEN_RATE'
            ? 'Zoho-reported open rate'
            : code === 'UNIQUE_CLICK_RATE'
              ? 'Zoho-reported unique click rate'
              : code.replaceAll('_', ' ').toLowerCase(),
        unit:
          code === 'OPEN_RATE' || code === 'UNIQUE_CLICK_RATE'
            ? 'PERCENT'
            : 'COUNT',
        mode: 'SUM',
        value,
        previous: null,
        difference: null,
        percentageChange: null,
      })),
      series: [],
      topPosts: report.campaigns.map((campaign) => {
        const sentValue = (campaign.metricValues as Record<string, unknown>)
          .SENT;
        return {
          externalPostId: campaign.externalCampaignId,
          title: campaign.name,
          postType: 'EMAIL CAMPAIGN',
          permalink: null,
          publishedAt: campaign.sentAt,
          dataScope: 'CUMULATIVE',
          metricCode: 'SENT',
          metricValue:
            typeof sentValue === 'number' && Number.isFinite(sentValue)
              ? sentValue
              : null,
        };
      }),
      caveats: report.caveats,
      dataAvailableThrough: report.account.lastSyncedAt,
      generatedAt: report.generatedAt,
    });
  }

  async disconnect(id: string, actorId: string) {
    const account = await this.getActiveAccount(id);
    let providerAccessRevocation: ProviderAccessRevocation = 'not_supported';
    if (
      account.provider === 'YOUTUBE' ||
      account.provider === 'ZOHO_CAMPAIGNS'
    ) {
      try {
        if (!account.credentialCiphertext)
          throw new Error('No credential remains for revocation.');
        const credentials = decryptCredentials(account.credentialCiphertext);
        const grantToken = credentials.refreshToken ?? credentials.accessToken;
        const relatedAccounts = await this.prisma.connectedAccount.findMany({
          where: { provider: account.provider, active: true, id: { not: id } },
          select: { credentialCiphertext: true },
        });
        let couldNotCheckAllCredentials = false;
        const grantIsStillUsed = relatedAccounts.some((related) => {
          if (!related.credentialCiphertext) return false;
          try {
            const relatedCredentials = decryptCredentials(
              related.credentialCiphertext,
            );
            return credentials.refreshToken
              ? relatedCredentials.refreshToken === grantToken
              : relatedCredentials.accessToken === grantToken;
          } catch {
            // An unreadable sibling credential might still use this grant.
            couldNotCheckAllCredentials = true;
            return false;
          }
        });

        if (grantIsStillUsed) {
          providerAccessRevocation = 'still_in_use';
        } else if (couldNotCheckAllCredentials) {
          providerAccessRevocation = 'failed';
        } else {
          providerAccessRevocation =
            await this.providerClient.revokeCredentials(
              account.provider,
              credentials,
            );
        }
      } catch {
        // A provider outage or missing OAuth config must not prevent a local disconnect.
        providerAccessRevocation = 'failed';
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.connectedAccount.update({
        where: { id },
        data: {
          active: false,
          credentialCiphertext: null,
          tokenExpiresAt: null,
        },
      });
      if (tx.connectedAccountSyncJob)
        await tx.connectedAccountSyncJob.updateMany({
          where: {
            connectedAccountId: id,
            status: { in: ['QUEUED', 'RUNNING'] },
          },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
            finalErrorCode: 'ACCOUNT_DISCONNECTED',
          },
        });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'ConnectedAccount',
          entityId: id,
          action: 'CONNECTED_ACCOUNT_DISCONNECTED',
          metadata: {
            provider: account.provider,
            providerAccessRevocation,
            historicalAnalyticsRetained: true,
          },
        },
      });
    });
    return {
      id,
      disconnected: true,
      historicalAnalyticsRetained: true,
      providerAccessRevocation,
    };
  }

  async deleteData(id: string, actorId: string) {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { id },
      select: { id: true, provider: true, active: true },
    });
    if (!account)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Connected account not found.',
      });
    if (account.active)
      throw new ConflictException({
        code: 'ACCOUNT_MUST_BE_DISCONNECTED',
        message: 'Disconnect the account before deleting its stored data.',
      });
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ active: boolean }>>`
        SELECT "active"
        FROM "social_media_dashboard"."ConnectedAccount"
        WHERE "id" = ${id}::uuid
        FOR UPDATE
      `;
      if (locked[0]?.active)
        throw new ConflictException({
          code: 'ACCOUNT_MUST_BE_DISCONNECTED',
          message: 'Disconnect the account before deleting its stored data.',
        });
      if (tx.connectedAccountSyncJob)
        await tx.connectedAccountSyncJob.updateMany({
          where: {
            connectedAccountId: id,
            status: { in: ['QUEUED', 'RUNNING'] },
          },
          data: {
            status: 'CANCELLED',
            completedAt: new Date(),
            leaseToken: null,
            leaseUntil: null,
            finalErrorCode: 'ACCOUNT_DATA_DELETED',
          },
        });
      const records = await tx.connectedAccountAnalyticsRecord.findMany({
        where: { connectedAccountId: id },
        select: { id: true },
      });
      const recordIds = records.map((record) => record.id);
      if (recordIds.length)
        await tx.connectedAccountMetricValue.deleteMany({
          where: { recordId: { in: recordIds } },
        });
      await tx.connectedAccountAnalyticsRecord.deleteMany({
        where: { connectedAccountId: id },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'ConnectedAccount',
          entityId: id,
          action: 'CONNECTED_ACCOUNT_DATA_DELETED',
          metadata: {
            provider: account.provider,
            analyticsRecordsDeleted: recordIds.length,
          },
        },
      });
      await tx.connectedAccount.delete({ where: { id } });
    });
    return { id, deleted: true, historicalAnalyticsDeleted: true };
  }

  async runsNotApplicable() {
    return { message: 'Account-level sync history is shown on each account.' };
  }

  async cleanupExpiredData() {
    const now = new Date();
    await this.prisma.accountOAuthState.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { consumedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    await this.prisma.connectedAccountSyncJob.deleteMany({
      where: {
        completedAt: { lt: new Date(now.getTime() - 30 * 86_400_000) },
        status: { in: ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'] },
      },
    });
    await this.accountAnalytics.purgeExpired(now);
    const expiredProfiles = await this.prisma.connectedAccount.findMany({
      where: { provider: 'LINKEDIN', profileMetadataExpiresAt: { lt: now } },
      select: { id: true, externalAccountId: true },
    });
    for (const account of expiredProfiles)
      await this.prisma.connectedAccount.update({
        where: { id: account.id },
        data: {
          displayName: `LinkedIn organization ${account.externalAccountId}`,
          handle: null,
          profileUrl: null,
          profileMetadataExpiresAt: null,
        },
      });
  }

  private async dailyRefresh() {
    const cutoff = new Date(Date.now() - 23 * 60 * 60 * 1000);
    const accounts = await this.prisma.connectedAccount.findMany({
      where: {
        active: true,
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
      },
      select: { id: true, provider: true },
      orderBy: { lastSyncedAt: 'asc' },
      take: 50,
    });
    for (const account of accounts) {
      if (this.syncing.has(account.id)) continue;
      const to = this.today();
      // Refresh the full default dashboard window so daily activity and
      // period-scoped top content stay current together.
      const from = this.shiftDay(to, -29);
      try {
        if (
          account.provider === 'INSTAGRAM' ||
          account.provider === 'FACEBOOK'
        ) {
          const accountDetails = await this.prisma.connectedAccount.findUnique({
            where: { id: account.id },
            select: { historyBootstrapEnqueuedAt: true },
          });
          const bootstrap = !accountDetails?.historyBootstrapEnqueuedAt;
          await this.enqueueMetaSync(
            account.id,
            bootstrap ? this.shiftDay(to, -364) : from,
            to,
            'SCHEDULED',
            null,
            bootstrap,
          );
          continue;
        }
        await this.syncAccount(account.id, from, to, true);
      } catch {
        // The account's lastSyncErrorCode records the failure without logging
        // credentials or provider response bodies.
      }
    }
    await this.cleanupExpiredData();
  }

  private async accountMetricRows(
    accountId: string,
    from: string,
    to: string,
  ): Promise<AccountMetricRow[]> {
    const now = new Date();
    const records = await this.prisma.connectedAccountAnalyticsRecord.findMany({
      where: {
        connectedAccountId: accountId,
        scope: 'ACCOUNT',
        recordDate: { gte: dateValue(from), lte: dateValue(to) },
        metricValues: { some: unexpiredMetricValue(now) },
      },
      include: {
        metricValues: {
          where: unexpiredMetricValue(now),
          include: { metricDefinition: true },
        },
      },
      orderBy: { recordDate: 'asc' },
    });
    return records.flatMap((record) =>
      record.metricValues.map((item) => ({
        metricCode: item.metricDefinition.code,
        scope:
          item.metricDefinition.aggregationStrategy === 'LAST'
            ? ('SNAPSHOT' as const)
            : ('DAILY' as const),
        metricDate: record.recordDate,
        retrievedAt: record.retrievedAt,
        value: item.value,
      })),
    );
  }

  private async latestAudienceSnapshot(
    accountId: string,
    before: string,
  ): Promise<AccountMetricRow | null> {
    const now = new Date();
    const metricFilter = {
      ...unexpiredMetricValue(now),
      metricDefinition: { code: 'AUDIENCE_SIZE' },
    };
    const record = await this.prisma.connectedAccountAnalyticsRecord.findFirst({
      where: {
        connectedAccountId: accountId,
        scope: 'ACCOUNT',
        recordDate: { lt: dateValue(before) },
        metricValues: { some: metricFilter },
      },
      include: {
        metricValues: {
          where: metricFilter,
          include: { metricDefinition: true },
          take: 1,
        },
      },
      orderBy: { recordDate: 'desc' },
    });
    const item = record?.metricValues[0];
    return record && item
      ? {
          metricCode: item.metricDefinition.code,
          scope: 'SNAPSHOT',
          metricDate: record.recordDate,
          retrievedAt: record.retrievedAt,
          value: item.value,
        }
      : null;
  }

  private async contentObservations(
    accountId: string,
    from: string,
    to: string,
  ) {
    const now = new Date();
    const records = await this.prisma.connectedAccountAnalyticsRecord.findMany({
      where: {
        connectedAccountId: accountId,
        scope: 'CONTENT',
        periodFrom: dateValue(from),
        periodTo: dateValue(to),
        metricValues: { some: unexpiredMetricValue(now) },
      },
      include: {
        metricValues: {
          where: unexpiredMetricValue(now),
          include: { metricDefinition: true },
        },
      },
      orderBy: { retrievedAt: 'desc' },
    });
    return records.map((record) => ({
      sourceObjectId: record.sourceObjectId,
      objectTitle: record.objectTitle,
      objectType: record.objectType,
      objectUrl: record.objectUrl,
      objectOccurredAt: record.objectOccurredAt,
      dataScope: record.dataScope,
      metricValues: Object.fromEntries(
        record.metricValues.map((item) => [
          item.metricDefinition.code,
          Number(item.value),
        ]),
      ),
    }));
  }

  private async previousAudienceDelta(
    provider: ConnectedAccountProvider,
    accountId: string,
    range: { from: string; to: string },
  ) {
    const [rows, before] = await Promise.all([
      this.accountMetricRows(accountId, range.from, range.to),
      this.latestAudienceSnapshot(accountId, range.from),
    ]);
    const last = this.latestSnapshot(rows, 'AUDIENCE_SIZE', range.to);
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK') {
      const beforeDate = before?.metricDate.toISOString().slice(0, 10);
      const lastRow = this.latestSnapshotRow(rows, 'AUDIENCE_SIZE', range.to);
      if (
        !before ||
        beforeDate !== this.shiftDay(range.from, -1) ||
        lastRow?.metricDate.toISOString().slice(0, 10) !== range.to
      )
        return null;
    }
    return this.audienceDelta(
      provider,
      rows,
      before ? numberValue(before.value) : null,
      last,
    );
  }

  private audienceDelta(
    provider: ConnectedAccountProvider,
    rows: Array<{
      metricCode: string;
      scope: string;
      metricDate: Date;
      value: Prisma.Decimal;
    }>,
    previousSnapshot: number | null,
    currentSnapshot: number | null,
  ) {
    if (provider === 'LINKEDIN') return this.sum(rows, 'ORGANIC_NEW_FOLLOWERS');
    if (provider === 'YOUTUBE') {
      const gained = this.sum(rows, 'SUBSCRIBERS_GAINED');
      const lost = this.sum(rows, 'SUBSCRIBERS_LOST');
      return gained === null || lost === null ? null : gained - lost;
    }
    return previousSnapshot === null || currentSnapshot === null
      ? null
      : currentSnapshot - previousSnapshot;
  }

  private metricValue(
    code: string,
    mode: 'SUM' | 'SNAPSHOT' | 'DERIVED',
    totals: Map<string, number>,
    snapshot: number | null,
    audienceDelta: number | null,
  ) {
    if (mode === 'SNAPSHOT') return snapshot;
    if (mode === 'DERIVED') return audienceDelta;
    return totals.get(code) ?? null;
  }

  private latestSnapshot(
    rows: Array<{
      metricCode: string;
      scope: string;
      metricDate: Date;
      value: Prisma.Decimal;
    }>,
    code: string,
    end: string,
  ) {
    const row = this.latestSnapshotRow(rows, code, end);
    return row ? numberValue(row.value) : null;
  }

  private latestSnapshotRow<
    T extends {
      metricCode: string;
      scope: string;
      metricDate: Date;
      value: Prisma.Decimal;
    },
  >(rows: T[], code: string, end: string) {
    return rows
      .filter(
        (item) =>
          item.scope === 'SNAPSHOT' &&
          item.metricCode === code &&
          item.metricDate <= dateValue(end),
      )
      .sort((a, b) => b.metricDate.getTime() - a.metricDate.getTime())[0];
  }

  private totals(
    rows: Array<{ metricCode: string; scope: string; value: Prisma.Decimal }>,
  ) {
    const totals = new Map<string, number>();
    for (const row of rows) {
      if (row.scope === 'SNAPSHOT') continue;
      totals.set(
        row.metricCode,
        (totals.get(row.metricCode) ?? 0) + numberValue(row.value),
      );
    }
    return totals;
  }

  private sum(
    rows: Array<{ metricCode: string; scope: string; value: Prisma.Decimal }>,
    code: string,
  ) {
    const matching = rows.filter(
      (row) => row.metricCode === code && row.scope === 'DAILY',
    );
    return matching.length
      ? matching.reduce((total, row) => total + numberValue(row.value), 0)
      : null;
  }

  private async getActiveAccount(id: string) {
    const account = await this.getAccount(id);
    if (!account.active)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Connected account not found or disconnected.',
      });
    return account;
  }

  private async getAccount(id: string) {
    const account = await this.prisma.connectedAccount.findUnique({
      where: { id },
    });
    if (!account)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Connected account not found.',
      });
    return account;
  }

  private retentionInfo(provider: ConnectedAccountProvider) {
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK')
      return {
        reportingDays: 365,
        postSnapshotDays: 90,
        ...this.capabilities(provider),
      };
    if (provider === 'LINKEDIN')
      return {
        reportingDays: 364,
        postSnapshotDays: 42,
        ...this.capabilities(provider),
      };
    return {
      reportingDays: null,
      postSnapshotDays: null,
      ...this.capabilities(provider),
    };
  }

  private capabilities(provider: ConnectedAccountProvider) {
    if (provider === 'INSTAGRAM')
      return {
        maxReportDays: 365,
        accountMetricRetentionDays: 365,
        postSnapshotRetentionDays: 90,
        historyFetchDays: 90,
      };
    if (provider === 'FACEBOOK')
      return {
        maxReportDays: 365,
        accountMetricRetentionDays: 365,
        postSnapshotRetentionDays: 90,
        historyFetchDays: 365,
      };
    if (provider === 'LINKEDIN')
      return {
        maxReportDays: 365,
        accountMetricRetentionDays: 364,
        postSnapshotRetentionDays: 42,
        historyFetchDays: 365,
      };
    if (provider === 'YOUTUBE')
      return {
        maxReportDays: 365,
        accountMetricRetentionDays: null,
        postSnapshotRetentionDays: null,
        historyFetchDays: null,
      };
    return {
      maxReportDays: 3650,
      accountMetricRetentionDays: null,
      postSnapshotRetentionDays: null,
      historyFetchDays: null,
    };
  }

  private caveats(provider: ConnectedAccountProvider) {
    if (provider === 'INSTAGRAM')
      return [
        'Instagram supplies recent account history (up to 90 days). Older days already collected remain available in Marketwise; missing dates are shown as gaps.',
        'Account metrics are retained for up to 365 days after retrieval. Post snapshots keep their separate 90-day retention.',
        'Daily reach observations are not a deduplicated count of unique accounts across the reporting period.',
        'Follower count is a snapshot from the date it was retrieved; historical follower values are not reconstructed.',
        'Top content uses only eligible posts retained for this report period and is not a complete annual ranking.',
      ];
    if (provider === 'FACEBOOK')
      return [
        'Page visits count visits to the Page profile. Paid and mixed content views are excluded; organic media views appear only when the provider explicitly returns the unpaid breakdown.',
        'Follower change compares provider follower-count snapshots when available.',
        'Facebook account metrics are retained for up to 365 days after retrieval. Post snapshots keep their separate 90-day retention.',
        'Daily reach observations are not a deduplicated count of unique people across the reporting period.',
        'Top content uses only eligible posts retained for this report period and is not a complete annual ranking.',
      ];
    if (provider === 'LINKEDIN')
      return [
        'LinkedIn organization share analytics are organic-only and available for a rolling 12-month window.',
        'Only organic follower gains are shown. The paid follower-gain field is not included in organic account analytics.',
        'LinkedIn permits one year of organization reporting data storage. Organization post content is removed after six weeks in this app.',
        'Top-content ranking is based on up to 20 eligible posts; post impression counts are lifetime totals.',
      ];
    return [
      'YouTube views, watch time, likes, and subscriber change are channel analytics. Recent days may be delayed by YouTube.',
      'Subscriber change is gained subscribers minus lost subscribers for the selected period.',
      'Top-content ranking is based on up to 10 videos returned for the selected date range; post view counts use that selected-period range.',
    ];
  }

  private validateRange(from: string, to: string) {
    try {
      validDay(from);
      validDay(to);
    } catch {
      throw new BadRequestException({
        code: 'INVALID_ACCOUNT_DATE_RANGE',
        message: 'Choose valid start and end dates.',
      });
    }
    if (from > to || to > this.today())
      throw new BadRequestException({
        code: 'INVALID_ACCOUNT_DATE_RANGE',
        message:
          'The start date must be before the end date, and future dates are not available.',
      });
  }

  private validateProviderRange(
    provider: ConnectedAccountProvider,
    from: string,
    to: string,
  ) {
    const days = dayDiff(from, to);
    const maxDays =
      provider === 'INSTAGRAM' || provider === 'FACEBOOK'
        ? 365
        : provider === 'LINKEDIN'
          ? 365
          : provider === 'YOUTUBE'
            ? 365
            : 3650;
    if (days > maxDays)
      throw new BadRequestException({
        code: 'ACCOUNT_DATE_RANGE_TOO_WIDE',
        message: `${provider === 'INSTAGRAM' || provider === 'FACEBOOK' ? 'Instagram and Facebook' : provider === 'LINKEDIN' ? 'LinkedIn' : 'This provider'} reports can cover up to ${maxDays} calendar days at a time.`,
      });
    const lookback = provider === 'LINKEDIN' ? 365 : null;
    if (lookback && dayDiff(from, this.today()) > lookback)
      throw new BadRequestException({
        code: 'ACCOUNT_DATA_RETENTION_WINDOW',
        message:
          'LinkedIn has no data available before its current reporting window.',
      });
  }

  private isProvider(value: string): value is ConnectedAccountProvider {
    return [
      'INSTAGRAM',
      'FACEBOOK',
      'LINKEDIN',
      'YOUTUBE',
      'ZOHO_CAMPAIGNS',
    ].includes(value);
  }

  private redirectUri() {
    const value = process.env.INTEGRATION_OAUTH_REDIRECT_URI?.trim();
    if (!value)
      throw new BadRequestException({
        code: 'OAUTH_CALLBACK_REQUIRED',
        message:
          'Configure the registered provider callback URL before connecting accounts.',
      });
    try {
      const url = new URL(value);
      if (
        url.protocol !== 'https:' &&
        !(url.hostname === 'localhost' && url.protocol === 'http:')
      )
        throw new Error('Invalid callback protocol');
      return url.toString();
    } catch {
      throw new BadRequestException({
        code: 'OAUTH_CALLBACK_INVALID',
        message: 'Configure a valid HTTPS provider callback URL.',
      });
    }
  }

  private appOrigin() {
    try {
      const url = new URL(process.env.APP_ORIGIN ?? 'http://localhost:3000');
      return url.origin;
    } catch {
      return 'http://localhost:3000';
    }
  }

  private callbackUrl(
    origin: string,
    status: string,
    provider?: ConnectedAccountProvider,
  ) {
    const url = new URL('/', origin);
    url.searchParams.set('accountConnection', status);
    if (provider) url.searchParams.set('provider', provider.toLowerCase());
    url.hash = 'accounts';
    return url.toString();
  }

  private errorCode(error: unknown) {
    if (error instanceof AccountProviderFailure) return error.code;
    if (error && typeof error === 'object' && 'response' in error)
      return 'PROVIDER_REQUEST_FAILED';
    return 'SYNC_FAILED';
  }

  private today() {
    const timezone = process.env.REPORTING_TIMEZONE ?? 'Africa/Lagos';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const get = (type: string) =>
      parts.find((part) => part.type === type)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  private shiftDay(value: string, days: number) {
    const date = dateValue(value);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private nextDayDate(value: string) {
    return dateValue(this.shiftDay(value, 1));
  }
}
