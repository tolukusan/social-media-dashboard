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
const dateValue = (value: string) =>
  new Date(`${validDay(value)}T00:00:00.000Z`);
const jsonValue = (value: unknown) => value as Prisma.InputJsonValue;

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
  private readonly syncing = new Set<string>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccountProviderClient)
    private readonly providerClient: AccountProviderClient,
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
    void this.cleanupExpiredData().catch(() => undefined);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
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
      ).map((provider) => ({ provider, ...providerSetup(provider) })),
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
      await this.enforceRetention(account.provider, id);
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
  ) {
    await this.prisma.$transaction(async (tx) => {
      for (const metric of result.metrics)
        await tx.accountDailyMetric.upsert({
          where: {
            accountId_metricCode_metricDate_scope: {
              accountId,
              metricCode: metric.code,
              metricDate: dateValue(metric.date),
              scope: metric.scope,
            },
          },
          create: {
            id: randomUUID(),
            accountId,
            metricCode: metric.code,
            sourceMetric: metric.sourceMetric,
            metricDate: dateValue(metric.date),
            scope: metric.scope,
            value: metric.value,
          },
          update: {
            sourceMetric: metric.sourceMetric,
            value: metric.value,
          },
        });
      const fromDate = dateValue(from);
      const toDate = dateValue(to);
      for (const post of result.posts)
        await tx.accountPostSnapshot.upsert({
          where: {
            accountId_externalPostId_periodFrom_periodTo: {
              accountId,
              externalPostId: post.externalPostId,
              periodFrom: fromDate,
              periodTo: toDate,
            },
          },
          create: {
            id: randomUUID(),
            accountId,
            externalPostId: post.externalPostId,
            title: post.title,
            postType: post.postType,
            permalink: post.permalink,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
            periodFrom: fromDate,
            periodTo: toDate,
            dataScope: post.dataScope,
            metricValues: jsonValue(post.metricValues),
            expiresAt: post.expiresAt
              ? new Date(post.expiresAt)
              : provider === 'LINKEDIN'
                ? new Date(Date.now() + 42 * 24 * 60 * 60 * 1000)
                : provider === 'INSTAGRAM' || provider === 'FACEBOOK'
                  ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  : null,
          },
          update: {
            title: post.title,
            postType: post.postType,
            permalink: post.permalink,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
            dataScope: post.dataScope,
            metricValues: jsonValue(post.metricValues),
            observedAt: new Date(),
            expiresAt: post.expiresAt
              ? new Date(post.expiresAt)
              : provider === 'LINKEDIN'
                ? new Date(Date.now() + 42 * 24 * 60 * 60 * 1000)
                : provider === 'INSTAGRAM' || provider === 'FACEBOOK'
                  ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
                  : null,
          },
        });
      for (const campaign of result.emailCampaigns)
        await tx.emailCampaignSnapshot.upsert({
          where: {
            accountId_externalCampaignId: {
              accountId,
              externalCampaignId: campaign.externalCampaignId,
            },
          },
          create: {
            id: randomUUID(),
            accountId,
            externalCampaignId: campaign.externalCampaignId,
            campaignName: campaign.campaignName,
            sentAt: campaign.sentAt ? new Date(campaign.sentAt) : null,
            metricValues: jsonValue(campaign.metricValues),
          },
          update: {
            campaignName: campaign.campaignName,
            sentAt: campaign.sentAt ? new Date(campaign.sentAt) : null,
            metricValues: jsonValue(campaign.metricValues),
            observedAt: new Date(),
          },
        });
    });
    await this.enforceRetention(provider, accountId);
  }

  async analytics(id: string, from: string, to: string) {
    this.validateRange(from, to);
    const account = await this.getActiveAccount(id);
    if (account.kind !== 'SOCIAL')
      throw new BadRequestException({
        code: 'SOCIAL_ANALYTICS_NOT_AVAILABLE',
        message:
          'Choose a social account to view this dashboard. Zoho data is in Email reports.',
      });
    this.validateProviderRange(account.provider, from, to);
    await this.enforceRetention(account.provider, account.id);
    const previous = previousRange(from, to);
    const [rows, previousRows, posts] = await Promise.all([
      this.prisma.accountDailyMetric.findMany({
        where: {
          accountId: id,
          metricDate: { gte: dateValue(from), lte: dateValue(to) },
        },
        orderBy: { metricDate: 'asc' },
      }),
      this.prisma.accountDailyMetric.findMany({
        where: {
          accountId: id,
          metricDate: {
            gte: dateValue(previous.from),
            lte: dateValue(previous.to),
          },
        },
        orderBy: { metricDate: 'asc' },
      }),
      this.prisma.accountPostSnapshot.findMany({
        where: {
          accountId: id,
          periodFrom: dateValue(from),
          periodTo: dateValue(to),
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { observedAt: 'desc' },
      }),
    ]);
    const currentSnapshot = this.latestSnapshot(rows, 'AUDIENCE_SIZE', to);
    const previousSnapshot = this.latestSnapshot(
      await this.prisma.accountDailyMetric.findMany({
        where: {
          accountId: id,
          scope: 'SNAPSHOT',
          metricCode: 'AUDIENCE_SIZE',
          metricDate: { lte: dateValue(previous.to) },
        },
        orderBy: { metricDate: 'desc' },
        take: 1,
      }),
      'AUDIENCE_SIZE',
      previous.to,
    );
    const startSnapshot = await this.prisma.accountDailyMetric.findFirst({
      where: {
        accountId: id,
        scope: 'SNAPSHOT',
        metricCode: 'AUDIENCE_SIZE',
        metricDate: { lt: dateValue(from) },
      },
      orderBy: { metricDate: 'desc' },
    });
    const catalog =
      metricCatalog[
        account.provider as Exclude<ConnectedAccountProvider, 'ZOHO_CAMPAIGNS'>
      ];
    const currentTotals = this.totals(rows);
    const previousTotals = this.totals(previousRows);
    const audienceDelta = this.audienceDelta(
      account.provider,
      rows,
      startSnapshot ? numberValue(startSnapshot.value) : null,
      currentSnapshot,
    );
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
      return {
        ...definition,
        value: current,
        previous: old,
        ...calculated(current, old),
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
            previousAudience !== null
          )
            values.AUDIENCE_CHANGE = current - previousAudience;
          previousAudience = current;
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
              externalPostId: post.externalPostId,
              title: post.title,
              postType: post.postType,
              permalink: post.permalink,
              publishedAt: post.publishedAt,
              dataScope: post.dataScope,
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
      caveats: this.caveats(account.provider),
      dataAvailableThrough: account.lastSyncedAt,
      generatedAt: now.toISOString(),
    };
  }

  async emailReport(id: string, from: string, to: string) {
    this.validateRange(from, to);
    const account = await this.getActiveAccount(id);
    if (account.provider !== 'ZOHO_CAMPAIGNS' || account.kind !== 'EMAIL')
      throw new BadRequestException({
        code: 'EMAIL_REPORT_NOT_AVAILABLE',
        message: 'Choose the Zoho Campaigns account to view email reports.',
      });
    const campaigns = await this.prisma.emailCampaignSnapshot.findMany({
      where: {
        accountId: id,
        sentAt: { gte: dateValue(from), lt: this.nextDayDate(to) },
      },
      orderBy: [{ sentAt: 'desc' }, { campaignName: 'asc' }],
    });
    const totalCodes = [
      'SENT',
      'DELIVERED',
      'OPENS',
      'UNIQUE_CLICKS',
      'BOUNCES',
      'UNSUBSCRIBES',
    ];
    const totals: Record<string, number> = Object.fromEntries(
      totalCodes.map((code) => [code, 0]),
    );
    for (const campaign of campaigns) {
      const values = campaign.metricValues as Record<string, unknown>;
      for (const code of totalCodes) {
        const value = values[code];
        if (typeof value === 'number' && Number.isFinite(value))
          totals[code] += value;
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
        label: code.replaceAll('_', ' ').toLowerCase(),
        unit: 'COUNT',
        mode: 'SUM',
        value,
        previous: null,
        difference: null,
        percentageChange: null,
      })),
      series: [],
      topPosts: report.campaigns.map((campaign) => ({
        externalPostId: campaign.externalCampaignId,
        title: campaign.name,
        postType: 'EMAIL CAMPAIGN',
        permalink: null,
        publishedAt: campaign.sentAt,
        dataScope: 'CUMULATIVE',
        metricCode: 'SENT',
        metricValue: Number(
          (campaign.metricValues as Record<string, unknown>).SENT ?? 0,
        ),
      })),
      caveats: report.caveats,
      dataAvailableThrough: report.account.lastSyncedAt,
      generatedAt: report.generatedAt,
    });
  }

  async disconnect(id: string, actorId: string) {
    const account = await this.getActiveAccount(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'ConnectedAccount',
          entityId: id,
          action: 'CONNECTED_ACCOUNT_DISCONNECTED_AND_DATA_DELETED',
          metadata: { provider: account.provider },
        },
      });
      await tx.connectedAccount.delete({ where: { id } });
    });
    return { id, disconnected: true, providerDataDeleted: true };
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
    await this.prisma.accountPostSnapshot.deleteMany({
      where: { expiresAt: { lt: now } },
    });
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
    const accounts = await this.prisma.connectedAccount.findMany({
      where: { provider: { in: ['INSTAGRAM', 'FACEBOOK', 'LINKEDIN'] } },
      select: { id: true, provider: true },
    });
    for (const account of accounts)
      await this.enforceRetention(account.provider, account.id);
  }

  private async enforceRetention(
    provider: ConnectedAccountProvider,
    accountId: string,
  ) {
    const days =
      provider === 'INSTAGRAM' || provider === 'FACEBOOK'
        ? 90
        : provider === 'LINKEDIN'
          ? 365
          : null;
    if (!days) return;
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    await this.prisma.accountDailyMetric.deleteMany({
      where: {
        accountId,
        metricDate: { lt: dateValue(cutoff.toISOString().slice(0, 10)) },
      },
    });
    await this.prisma.accountPostSnapshot.deleteMany({
      where: { accountId, expiresAt: { lt: new Date() } },
    });
    if (provider === 'LINKEDIN') {
      const account = await this.prisma.connectedAccount.findUnique({
        where: { id: accountId },
        select: {
          externalAccountId: true,
          profileMetadataExpiresAt: true,
        },
      });
      if (
        account?.profileMetadataExpiresAt &&
        account.profileMetadataExpiresAt < new Date()
      )
        await this.prisma.connectedAccount.update({
          where: { id: accountId },
          data: {
            displayName: `LinkedIn organization ${account.externalAccountId}`,
            handle: null,
            profileUrl: null,
            profileMetadataExpiresAt: null,
          },
        });
    }
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
        await this.syncAccount(account.id, from, to, true);
      } catch {
        // The account's lastSyncErrorCode records the failure without logging
        // credentials or provider response bodies.
      }
    }
    await this.cleanupExpiredData();
  }

  private async previousAudienceDelta(
    provider: ConnectedAccountProvider,
    accountId: string,
    range: { from: string; to: string },
  ) {
    const rows = await this.prisma.accountDailyMetric.findMany({
      where: {
        accountId,
        metricDate: { gte: dateValue(range.from), lte: dateValue(range.to) },
      },
      orderBy: { metricDate: 'asc' },
    });
    const before = await this.prisma.accountDailyMetric.findFirst({
      where: {
        accountId,
        metricCode: 'AUDIENCE_SIZE',
        scope: 'SNAPSHOT',
        metricDate: { lt: dateValue(range.from) },
      },
      orderBy: { metricDate: 'desc' },
    });
    const last = this.latestSnapshot(rows, 'AUDIENCE_SIZE', range.to);
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
    const row = rows
      .filter(
        (item) =>
          item.scope === 'SNAPSHOT' &&
          item.metricCode === code &&
          item.metricDate <= dateValue(end),
      )
      .sort((a, b) => b.metricDate.getTime() - a.metricDate.getTime())[0];
    return row ? numberValue(row.value) : null;
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
    const account = await this.prisma.connectedAccount.findUnique({
      where: { id },
    });
    if (!account || !account.active)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Connected account not found or disconnected.',
      });
    return account;
  }

  private retentionInfo(provider: ConnectedAccountProvider) {
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK')
      return { reportingDays: 90, postSnapshotDays: 90 };
    if (provider === 'LINKEDIN')
      return { reportingDays: 365, postSnapshotDays: 42 };
    return { reportingDays: null, postSnapshotDays: null };
  }

  private caveats(provider: ConnectedAccountProvider) {
    if (provider === 'INSTAGRAM')
      return [
        'Instagram insights are limited to the provider’s available 90-day window. Views and reach use separate provider definitions.',
        'Follower change compares total follower snapshots collected by this app; the first sync creates the baseline.',
      ];
    if (provider === 'FACEBOOK')
      return [
        'Page visits count visits to the Page profile. Paid and mixed content views are excluded; organic media views appear only when the provider explicitly returns the unpaid breakdown.',
        'Follower change compares provider follower-count snapshots when available.',
        'This app retains Facebook Page analytics and post snapshots for up to 90 days.',
      ];
    if (provider === 'LINKEDIN')
      return [
        'LinkedIn organization share analytics are organic-only and available for a rolling 12-month window.',
        'Only organic follower gains are shown. The paid follower-gain field is not included in organic account analytics.',
        'LinkedIn permits one year of organization reporting data storage. Organization post content is removed after six weeks in this app.',
      ];
    return [
      'YouTube views, watch time, likes, and subscriber change are channel analytics. Recent days may be delayed by YouTube.',
      'Subscriber change is gained subscribers minus lost subscribers for the selected period.',
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
        ? 90
        : provider === 'LINKEDIN'
          ? 365
          : provider === 'YOUTUBE'
            ? 365
            : 3650;
    if (days > maxDays)
      throw new BadRequestException({
        code: 'ACCOUNT_DATE_RANGE_TOO_WIDE',
        message: `${provider === 'INSTAGRAM' ? 'Instagram and Facebook' : provider === 'LINKEDIN' ? 'LinkedIn' : 'This provider'} reports can be synced for up to ${maxDays} days at a time.`,
      });
    const lookback =
      provider === 'INSTAGRAM' || provider === 'FACEBOOK'
        ? 90
        : provider === 'LINKEDIN'
          ? 365
          : null;
    if (lookback && dayDiff(from, this.today()) > lookback)
      throw new BadRequestException({
        code: 'ACCOUNT_DATA_RETENTION_WINDOW',
        message: `${provider === 'INSTAGRAM' ? 'Instagram' : provider === 'FACEBOOK' ? 'Facebook' : 'LinkedIn'} has no data available before its current reporting window.`,
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
