import { lockLifecycle, preventDeletedImport } from '../common/lifecycle.js';
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
import { reportingCurrencies } from '../settings/reporting-settings.service.js';
import { ProviderClient } from './provider-client.js';
import {
  configuration,
  day,
  fail,
  IntegrationFailure,
  providers,
  regions,
  shiftDay,
  sourceToday,
} from './integration-contract.js';
import type {
  DailyObservation,
  SourceConnection,
} from './integration-contract.js';
import { OAuthCredentialService } from './oauth-credential.service.js';
import type {
  CreateConnectionDto,
  CreateMappingDto,
  SyncConnectionDto,
  UpdateConnectionDto,
} from './integration.dto.js';

const contextInclude = {
  platform: { include: { channel: true } },
  campaignChannel: { include: { campaign: true, channel: true } },
} as const;
const dateValue = (value: string) => new Date(`${value}T00:00:00.000Z`);
const linkedinDataExpiry = (at: Date) =>
  new Date(at.getTime() + 364 * 24 * 60 * 60 * 1000);
const safeJson = (value: unknown) => value as Prisma.InputJsonValue;
const connectionSelect = {
  id: true,
  provider: true,
  platformId: true,
  displayName: true,
  externalAccountId: true,
  credentialReference: true,
  credentialMode: true,
  sourceTimezone: true,
  currency: true,
  region: true,
  active: true,
  autoSync: true,
  nextSyncAt: true,
  createdAt: true,
  platform: { select: { name: true, channel: { select: { name: true } } } },
  mappings: {
    include: {
      campaignPlatform: {
        include: {
          campaignChannel: {
            include: { campaign: { select: { name: true } } },
          },
        },
      },
    },
  },
  runs: { orderBy: { startedAt: 'desc' }, take: 1 },
  oauthCredential: {
    select: {
      status: true,
      tokenExpiresAt: true,
      refreshTokenExpiresAt: true,
      grantedScopes: true,
      connectedAt: true,
      lastRefreshedAt: true,
      lastErrorCode: true,
    },
  },
} satisfies Prisma.IntegrationConnectionSelect;

@Injectable()
export class IntegrationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private ticking = false;
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ProviderClient) private readonly client: ProviderClient,
    @Inject(OAuthCredentialService)
    private readonly oauth: OAuthCredentialService,
  ) {}

  onModuleInit() {
    if (
      process.env.INTEGRATIONS_SCHEDULER_ENABLED === 'false' ||
      process.env.TEST_DATABASE_URL
    )
      return;
    this.timer = setInterval(() => {
      void this.tick().catch(() => undefined);
    }, 60_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  options() {
    return {
      providers,
      regions,
      reportingTimezone: process.env.REPORTING_TIMEZONE ?? 'Africa/Lagos',
      credentialMode: 'SERVER_ENCRYPTED_OR_ENVIRONMENT',
      maxMappings: 10,
    };
  }
  async list() {
    const connections = await this.prisma.integrationConnection.findMany({
      select: connectionSelect,
      orderBy: { createdAt: 'desc' },
    });
    return connections.map((connection) => ({
      ...connection,
      configuration: configuration(
        connection,
        connection.oauthCredential?.status === 'CONNECTED',
      ),
    }));
  }
  async runs(id: string) {
    await this.get(id);
    return this.prisma.integrationRun.findMany({
      where: { connectionId: id },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
  private async get(id: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { id },
    });
    if (!connection)
      throw new NotFoundException({
        code: 'INTEGRATION_NOT_FOUND',
        message: 'Integration connection not found.',
      });
    return connection;
  }
  private async audit(
    tx: Prisma.TransactionClient,
    actorId: string,
    id: string,
    action: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId: actorId,
        entityType: 'IntegrationConnection',
        entityId: id,
        action,
        metadata,
      },
    });
  }
  private conflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException({
        code: 'INTEGRATION_DUPLICATE',
        message: 'This provider account or campaign mapping already exists.',
      });
    throw error;
  }
  async create(dto: CreateConnectionDto, actorId: string) {
    try {
      new Intl.DateTimeFormat('en', { timeZone: dto.sourceTimezone }).format();
    } catch {
      throw new BadRequestException({
        code: 'INVALID_SOURCE_TIMEZONE',
        message: 'Choose a valid source timezone.',
      });
    }
    if (
      !dto.displayName.trim() ||
      (dto.currency && !reportingCurrencies.includes(dto.currency))
    )
      throw new BadRequestException({
        code: 'INVALID_INTEGRATION_CONFIGURATION',
        message: 'Choose a supported currency and connection name.',
      });
    if (dto.provider === 'LINKEDIN_ADS' && dto.sourceTimezone !== 'UTC')
      throw new BadRequestException({
        code: 'INVALID_SOURCE_TIMEZONE',
        message:
          'LinkedIn daily advertising reports use UTC. Choose UTC as the source timezone.',
      });
    if (
      dto.provider !== 'ZOHO_CAMPAIGNS' &&
      (!/^\d+$/.test(dto.externalAccountId) ||
        !dto.currency ||
        (dto.region && dto.region !== 'US'))
    )
      throw new BadRequestException({
        code: 'INVALID_AD_ACCOUNT',
        message:
          'Advertising connections require a numeric account ID and currency. Region applies only to Zoho.',
      });
    const platform = await this.prisma.platform.findUnique({
      where: { id: dto.platformId },
      include: { channel: true },
    });
    if (
      !platform?.active ||
      !platform.channel.active ||
      platform.channel.code !==
        (dto.provider === 'ZOHO_CAMPAIGNS' ? 'EMAIL' : 'ADVERTISING')
    )
      throw new BadRequestException({
        code: 'INTEGRATION_PLATFORM_INVALID',
        message:
          'Select an active Email Marketing platform for Zoho, or an Online Advertising platform for ads.',
      });
    return this.prisma
      .$transaction(async (tx) => {
        await lockLifecycle(tx);
        const connection = await tx.integrationConnection.create({
          data: {
            provider: dto.provider,
            platformId: dto.platformId,
            displayName: dto.displayName.trim(),
            externalAccountId: dto.externalAccountId,
            credentialReference: dto.credentialReference,
            sourceTimezone: dto.sourceTimezone,
            currency: dto.currency ?? null,
            region: dto.region ?? 'US',
            configuredByUserId: actorId,
          },
          select: connectionSelect,
        });
        await this.audit(tx, actorId, connection.id, 'INTEGRATION_CONFIGURED', {
          provider: dto.provider,
        });
        return { ...connection, configuration: configuration(connection) };
      })
      .catch((error: unknown) => this.conflict(error));
  }
  private async lockConfiguration(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM social_media_dashboard."IntegrationConnection" WHERE id = ${id}::uuid FOR UPDATE`;
    const connection = await tx.integrationConnection.findUnique({
      where: { id },
    });
    if (!connection)
      throw new NotFoundException({
        code: 'INTEGRATION_NOT_FOUND',
        message: 'Integration connection not found.',
      });
    if (connection.leaseUntil && connection.leaseUntil > new Date())
      throw new ConflictException({
        code: 'INTEGRATION_BUSY',
        message:
          'A sync is running. Wait for it to finish before changing configuration.',
      });
    return connection;
  }
  async update(id: string, dto: UpdateConnectionDto, actorId: string) {
    if (dto.displayName !== undefined && !dto.displayName.trim())
      throw new BadRequestException('Enter a connection name.');
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      const previous = await this.lockConfiguration(tx, id);
      if (dto.sourceTimezone !== undefined) {
        try {
          new Intl.DateTimeFormat('en', {
            timeZone: dto.sourceTimezone,
          }).format();
        } catch {
          throw new BadRequestException('Choose a valid source timezone.');
        }
        if (
          previous.provider === 'LINKEDIN_ADS' &&
          dto.sourceTimezone !== 'UTC'
        )
          throw new BadRequestException('LinkedIn daily reports use UTC.');
      }
      if (
        dto.currency !== undefined &&
        !reportingCurrencies.includes(dto.currency)
      )
        throw new BadRequestException('Choose a supported currency.');
      if (
        ((dto.sourceTimezone !== undefined &&
          dto.sourceTimezone !== previous.sourceTimezone) ||
          (dto.currency !== undefined && dto.currency !== previous.currency)) &&
        (await tx.performanceRecord.count({
          where: { integrationMapping: { connectionId: id } },
        }))
      )
        throw new ConflictException({
          code: 'INTEGRATION_HISTORY_PROTECTED',
          message:
            'Currency and source timezone cannot be changed after importing daily history. Create a separate source instead.',
        });
      const connection = await tx.integrationConnection.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.credentialReference !== undefined &&
          dto.credentialReference !== previous.credentialReference
            ? {
                credentialMode: 'SERVER_ENVIRONMENT' as const,
                oauthGeneration: { increment: 1 },
              }
            : {}),
          ...(dto.active === false && previous.active
            ? { oauthGeneration: { increment: 1 } }
            : {}),
          ...(dto.displayName !== undefined
            ? { displayName: dto.displayName.trim() }
            : {}),
          configuredByUserId: actorId,
          nextSyncAt: new Date(),
        },
        select: connectionSelect,
      });
      if (
        dto.credentialReference !== undefined &&
        dto.credentialReference !== previous.credentialReference
      )
        await tx.integrationOAuthCredential.deleteMany({
          where: { connectionId: id },
        });
      if (
        (dto.credentialReference !== undefined &&
          dto.credentialReference !== previous.credentialReference) ||
        (dto.active === false && previous.active)
      )
        await tx.integrationOAuthAttempt.updateMany({
          where: { connectionId: id, status: 'PENDING' },
          data: { status: 'EXPIRED', consumedAt: new Date() },
        });
      await this.audit(tx, actorId, id, 'INTEGRATION_SETTINGS_UPDATED', {
        active: connection.active,
        autoSync: connection.autoSync,
      });
      return {
        ...connection,
        configuration: configuration(
          connection,
          connection.oauthCredential?.status === 'CONNECTED',
        ),
      };
    });
  }
  async disconnect(id: string, actorId: string) {
    await this.get(id);
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      await tx.integrationConnection.update({
        where: { id },
        data: {
          active: false,
          autoSync: false,
          oauthGeneration: { increment: 1 },
          leaseToken: null,
          leaseUntil: null,
        },
      });
      await tx.integrationRun.updateMany({
        where: { connectionId: id, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          errorCode: 'CONNECTION_DISCONNECTED',
          completedAt: new Date(),
        },
      });
      await tx.integrationOAuthCredential.deleteMany({
        where: { connectionId: id },
      });
      await tx.integrationOAuthAttempt.updateMany({
        where: { connectionId: id, status: 'PENDING' },
        data: { status: 'EXPIRED', consumedAt: new Date() },
      });
      await this.audit(tx, actorId, id, 'INTEGRATION_DISCONNECTED');
      return {
        id,
        active: false,
        oauthCredentialRemoved: true,
        providerAuthorizationMayRemain: true,
      };
    });
  }
  async map(id: string, dto: CreateMappingDto, actorId: string) {
    return this.prisma
      .$transaction(async (tx) => {
        await lockLifecycle(tx);
        const connection = await this.lockConfiguration(tx, id);
        if (!connection.active)
          throw new BadRequestException(
            'Resume the connection before adding a mapping.',
          );
        if (
          (await tx.integrationMapping.count({
            where: { connectionId: id },
          })) >= 10
        )
          throw new BadRequestException(
            'A connection supports up to 10 campaign mappings.',
          );
        const context = await tx.campaignPlatform.findUnique({
          where: { id: dto.campaignPlatformId },
          include: contextInclude,
        });
        if (
          !context ||
          context.platformId !== connection.platformId ||
          !context.platform.active ||
          !context.campaignChannel.channel.active ||
          context.campaignChannel.campaign.archivedAt
        )
          throw new BadRequestException({
            code: 'INVALID_INTEGRATION_MAPPING',
            message:
              'Choose an active campaign using this connection platform.',
          });
        if (
          connection.provider !== 'ZOHO_CAMPAIGNS' &&
          !/^\d+$/.test(dto.externalCampaignId)
        )
          throw new BadRequestException(
            'Advertising campaign IDs must contain digits only.',
          );
        const mapping = await tx.integrationMapping.create({
          data: { connectionId: id, ...dto },
        });
        await this.audit(tx, actorId, id, 'INTEGRATION_CAMPAIGN_MAPPED', {
          mappingId: mapping.id,
          campaignPlatformId: dto.campaignPlatformId,
        });
        return mapping;
      })
      .catch((error: unknown) => this.conflict(error));
  }

  async unmap(id: string, mappingId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      await this.lockConfiguration(tx, id);
      const mapping = await tx.integrationMapping.findFirst({
        where: { id: mappingId, connectionId: id },
      });
      if (!mapping) throw new NotFoundException('Mapping not found.');
      await tx.performanceRecord.updateMany({
        where: { integrationMappingId: mappingId },
        data: { integrationMappingId: null, integrationManaged: false },
      });
      await tx.integrationMapping.delete({ where: { id: mappingId } });
      await this.audit(tx, actorId, id, 'INTEGRATION_CAMPAIGN_UNMAPPED', {
        mappingId,
        campaignPlatformId: mapping.campaignPlatformId,
      });
      return { removed: true, historyRetained: true };
    });
  }

  private async ingest(
    connectionId: string,
    token: string,
    mappingId: string,
    observations: DailyObservation[],
    actorId: string,
    from: string,
    to: string,
  ) {
    const seen = new Set<string>();
    for (const row of observations) {
      day(row.date);
      if (
        row.date < from ||
        row.date > to ||
        seen.has(row.date) ||
        !Object.keys(row.values).length
      )
        fail(
          'INVALID_DAILY_OBSERVATIONS',
          'The source returned duplicate, empty, or out-of-range daily data.',
        );
      seen.add(row.date);
    }
    return this.prisma.$transaction(
      async (tx) => {
        await lockLifecycle(tx);
        const retrievedAt = new Date();
        const fenced = await tx.integrationConnection.updateMany({
          where: {
            id: connectionId,
            leaseToken: token,
            active: true,
            leaseUntil: { gt: new Date() },
          },
          data: { leaseUntil: new Date(Date.now() + 15 * 60_000) },
        });
        if (!fenced.count)
          fail(
            'SYNC_LEASE_LOST',
            'The sync was cancelled or its lease expired. Retry safely.',
          );
        const connection = await tx.integrationConnection.findUniqueOrThrow({
          where: { id: connectionId },
        });
        const sourceDataExpiresAt = connection.provider.startsWith('LINKEDIN')
          ? linkedinDataExpiry(retrievedAt)
          : null;
        await tx.$queryRaw`SELECT id FROM social_media_dashboard."User" WHERE id IN (${actorId}::uuid, ${connection.configuredByUserId}::uuid) ORDER BY id FOR SHARE`;
        const actors = await tx.user.findMany({
          where: { id: { in: [actorId, connection.configuredByUserId] } },
          include: { role: true },
        });
        const actor = actors.find((user) => user.id === actorId);
        const owner = actors.find(
          (user) => user.id === connection.configuredByUserId,
        );
        if (
          !actor?.active ||
          !actor.role.active ||
          !['ADMIN', 'MARKETING_OFFICER'].includes(actor.role.code) ||
          !owner?.active ||
          !owner.role.active ||
          owner.role.code !== 'ADMIN'
        )
          fail(
            'INTEGRATION_AUTHORITY_INACTIVE',
            'An active Administrator must configure this connection.',
          );
        const mapping = await tx.integrationMapping.findUniqueOrThrow({
          where: { id: mappingId },
          include: { campaignPlatform: { include: contextInclude } },
        });
        const context = mapping.campaignPlatform;
        // Coordinate with archive/deactivation and monetary-settings writes inside this transaction.
        await tx.$queryRaw`SELECT id FROM social_media_dashboard."Campaign" WHERE id = ${context.campaignChannel.campaignId}::uuid FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM social_media_dashboard."Platform" WHERE id = ${context.platformId}::uuid FOR SHARE`;
        await tx.$queryRaw`SELECT id FROM social_media_dashboard."MarketingChannel" WHERE id = ${context.campaignChannel.channelId}::uuid FOR SHARE`;
        const current = await tx.campaignPlatform.findUniqueOrThrow({
          where: { id: context.id },
          include: contextInclude,
        });
        if (
          current.campaignChannel.campaign.archivedAt ||
          !current.platform.active ||
          !current.campaignChannel.channel.active
        )
          fail(
            'INACTIVE_INTEGRATION_CONTEXT',
            'The campaign, channel, or platform is inactive.',
          );
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('reporting-currency'))`;
        const settings = await tx.reportingSettings.findUnique({
          where: { id: 'organisation' },
        });
        if (
          !connection.currency ||
          settings?.reportingCurrency !== connection.currency
        )
          fail(
            'REPORTING_CURRENCY_MISMATCH',
            'Set the reporting currency to the advertising account currency before importing. No currency conversion is performed.',
          );
        const definitions = await tx.channelMetric.findMany({
          where: {
            channelId: current.campaignChannel.channelId,
            active: true,
            inputEnabled: true,
            metricDefinition: { active: true, kind: 'RAW' },
          },
          include: { metricDefinition: true },
        });
        const byCode = new Map(
          definitions.map((entry) => [
            entry.metricDefinition.code,
            entry.metricDefinition,
          ]),
        );
        const counts = {
          createdRecords: 0,
          updatedRecords: 0,
          unchangedRecords: 0,
          conflicts: 0,
        };
        for (const row of observations) {
          const recordDate = dateValue(row.date);
          if (
            recordDate < current.campaignChannel.campaign.startDate ||
            (current.campaignChannel.campaign.endDate &&
              recordDate > current.campaignChannel.campaign.endDate)
          ) {
            counts.conflicts++;
            continue;
          }
          const entries = Object.entries(row.values);
          for (const [code, value] of entries) {
            const definition = byCode.get(code);
            if (
              !definition ||
              !Number.isFinite(value) ||
              value < 0 ||
              value > Number.MAX_SAFE_INTEGER ||
              (definition.unit === 'COUNT' && !Number.isSafeInteger(value))
            )
              fail(
                'INVALID_RAW_METRIC',
                'The source returned an invalid or unsupported raw metric.',
              );
          }
          await tx.$queryRaw`SELECT id FROM social_media_dashboard."PerformanceRecord" WHERE "campaignPlatformId" = ${context.id}::uuid AND "recordDate" = ${recordDate} FOR UPDATE`;
          await preventDeletedImport(tx, context.id, recordDate);
          const existing = await tx.performanceRecord.findUnique({
            where: {
              campaignPlatformId_recordDate: {
                campaignPlatformId: context.id,
                recordDate,
              },
            },
            include: { metricValues: { include: { metricDefinition: true } } },
          });
          if (
            existing &&
            (existing.status === 'ARCHIVED' ||
              existing.integrationMappingId !== mappingId ||
              !existing.integrationManaged)
          ) {
            counts.conflicts++;
            continue;
          }
          if (
            existing &&
            existing.metricValues.length === entries.length &&
            existing.metricValues.every(
              (metric) =>
                row.values[metric.metricDefinition.code] ===
                Number(metric.value),
            )
          ) {
            if (connection.provider.startsWith('LINKEDIN'))
              await tx.performanceMetricValue.updateMany({
                where: { performanceRecordId: existing.id },
                data: {
                  sourceConnectionId: connectionId,
                  sourceDataExpiresAt,
                },
              });
            counts.unchangedRecords++;
            continue;
          }
          const record =
            existing ??
            (await tx.performanceRecord.create({
              data: {
                campaignPlatformId: context.id,
                recordDate,
                integrationMappingId: mappingId,
                integrationManaged: true,
                createdByUserId: actorId,
                updatedByUserId: actorId,
              },
            }));
          if (existing) {
            await tx.performanceMetricValue.deleteMany({
              where: { performanceRecordId: record.id },
            });
            await tx.performanceRecord.update({
              where: { id: record.id },
              data: { updatedByUserId: actorId },
            });
            counts.updatedRecords++;
          } else counts.createdRecords++;
          await tx.performanceMetricValue.createMany({
            data: entries.map(([code, value]) => ({
              performanceRecordId: record.id,
              metricDefinitionId: byCode.get(code)!.id,
              sourceConnectionId: connectionId,
              sourceDataExpiresAt,
              value,
            })),
          });
        }
        return counts;
      },
      { timeout: 20_000 },
    );
  }

  async sync(
    id: string,
    dto: SyncConnectionDto,
    actorId: string,
    scheduled = false,
  ) {
    const connection = await this.get(id);
    try {
      day(dto.from);
      day(dto.to);
      if (
        dto.from > dto.to ||
        (dateValue(dto.to).getTime() - dateValue(dto.from).getTime()) /
          86_400_000 >
          30 ||
        dto.to >= sourceToday(connection.sourceTimezone)
      )
        fail(
          'INVALID_SYNC_RANGE',
          'Choose up to 31 completed source-calendar days.',
        );
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_SYNC_RANGE',
        message:
          error instanceof IntegrationFailure
            ? error.message
            : 'Choose a valid date range.',
      });
    }
    const token = randomUUID();
    const run = await this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      const claim = await tx.integrationConnection.updateMany({
        where: {
          id,
          active: true,
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
          ...(scheduled
            ? { autoSync: true, nextSyncAt: { lte: new Date() } }
            : {}),
        },
        data: {
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 15 * 60_000),
        },
      });
      if (!claim.count)
        throw new ConflictException({
          code: 'INTEGRATION_BUSY_OR_PAUSED',
          message: 'The connection is paused, not due, or already syncing.',
        });
      await tx.integrationRun.updateMany({
        where: { connectionId: id, status: 'RUNNING' },
        data: {
          status: 'FAILED',
          errorCode: 'SYNC_INTERRUPTED',
          completedAt: new Date(),
        },
      });
      return tx.integrationRun.create({
        data: {
          connectionId: id,
          fromDate: dateValue(dto.from),
          toDate: dateValue(dto.to),
          triggeredBy: scheduled ? 'SCHEDULED' : 'MANUAL',
        },
      });
    });
    const counts = {
      createdRecords: 0,
      updatedRecords: 0,
      unchangedRecords: 0,
      conflicts: 0,
    };
    const outcomes: Array<{
      mappingId: string;
      errorCode?: string;
      snapshot?: unknown;
      observationCount?: number;
    }> = [];
    let errorCode: string | null = null;
    try {
      const current = await this.prisma.integrationConnection.findUniqueOrThrow(
        {
          where: { id },
          include: {
            configuredByUser: { include: { role: true } },
            platform: { include: { channel: true } },
            mappings: true,
          },
        },
      );
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        include: { role: true },
      });
      if (
        !actor?.active ||
        !actor.role.active ||
        !['ADMIN', 'MARKETING_OFFICER'].includes(actor.role.code) ||
        !current.configuredByUser.active ||
        !current.configuredByUser.role.active ||
        current.configuredByUser.role.code !== 'ADMIN'
      )
        fail(
          'INTEGRATION_AUTHORITY_INACTIVE',
          'An active Administrator must configure this connection.',
        );
      if (
        !current.active ||
        !current.platform.active ||
        !current.platform.channel.active
      )
        fail(
          'INACTIVE_INTEGRATION_CONTEXT',
          'The connection, platform, or channel is inactive.',
        );
      const accessToken = await this.oauth.accessToken(
        current as SourceConnection & { id: string },
      );
      const providerConnection = {
        ...current,
        ...(accessToken ? { accessToken } : {}),
      } as SourceConnection;
      const config = configuration(providerConnection, !!accessToken);
      if (!config.ready)
        fail(
          config.code!,
          'Configure server credentials and API version before syncing.',
        );
      if (!current.mappings.length)
        fail(
          'CAMPAIGN_MAPPING_REQUIRED',
          'Map an external campaign before syncing.',
        );
      if (
        current.provider !== 'ZOHO_CAMPAIGNS' &&
        current.sourceTimezone !==
          (process.env.REPORTING_TIMEZONE ?? 'Africa/Lagos')
      )
        fail(
          'SOURCE_TIMEZONE_MISMATCH',
          'Daily source and deployment reporting timezones must match; daily aggregates cannot be shifted accurately.',
        );
      for (const mapping of current.mappings) {
        try {
          const result = await this.client.fetchCampaign(
            providerConnection,
            mapping.externalCampaignId,
            dto.from,
            dto.to,
          );
          if (result.snapshot)
            outcomes.push({ mappingId: mapping.id, snapshot: result.snapshot });
          else {
            const delta = await this.ingest(
              id,
              token,
              mapping.id,
              result.observations,
              actorId,
              dto.from,
              dto.to,
            );
            for (const key of Object.keys(counts) as Array<keyof typeof counts>)
              counts[key] += delta[key];
            outcomes.push({
              mappingId: mapping.id,
              observationCount: result.observations.length,
            });
          }
        } catch (error) {
          if (
            error instanceof IntegrationFailure &&
            ['TOKEN_EXPIRED', 'PROVIDER_ACCESS_DENIED'].includes(error.code)
          )
            await this.oauth.markReauthorizationRequired(id, error.code);
          outcomes.push({
            mappingId: mapping.id,
            errorCode:
              error instanceof IntegrationFailure ? error.code : 'SYNC_FAILED',
          });
        }
      }
    } catch (error) {
      errorCode =
        error instanceof IntegrationFailure ? error.code : 'SYNC_FAILED';
    }
    const failed = outcomes.filter((outcome) => outcome.errorCode);
    const successful = outcomes.length - failed.length;
    const status = errorCode
      ? 'BLOCKED'
      : failed.length
        ? successful
          ? 'PARTIAL'
          : 'FAILED'
        : counts.conflicts
          ? 'PARTIAL'
          : 'SUCCEEDED';
    const finalCode = errorCode ?? failed[0]?.errorCode ?? null;
    return this.prisma.$transaction(async (tx) => {
      await lockLifecycle(tx);
      const released = await tx.integrationConnection.updateMany({
        where: {
          id,
          active: true,
          leaseToken: token,
          leaseUntil: { gt: new Date() },
        },
        data: {
          leaseToken: null,
          leaseUntil: null,
          nextSyncAt: new Date(
            Date.now() +
              (status === 'SUCCEEDED' ? 24 * 60 * 60_000 : 60 * 60_000),
          ),
        },
      });
      if (!released.count)
        return tx.integrationRun.findUniqueOrThrow({ where: { id: run.id } });
      const result = await tx.integrationRun.update({
        where: { id: run.id },
        data: {
          ...counts,
          status,
          errorCode: finalCode,
          summary: safeJson({
            outcomes,
            message:
              connection.provider === 'ZOHO_CAMPAIGNS'
                ? 'Cumulative campaign snapshots; excluded from daily analytics.'
                : 'Only mapped completed-day raw performance is imported.',
          }),
          completedAt: new Date(),
        },
      });
      await this.audit(tx, actorId, id, 'INTEGRATION_SYNC_FINISHED', {
        runId: run.id,
        status,
        ...counts,
      });
      return result;
    });
  }

  async tick() {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const due = await this.prisma.integrationConnection.findMany({
        where: {
          active: true,
          autoSync: true,
          nextSyncAt: { lte: new Date() },
          OR: [{ leaseUntil: null }, { leaseUntil: { lte: new Date() } }],
        },
        orderBy: { nextSyncAt: 'asc' },
        take: 10,
      });
      for (const connection of due) {
        const to = shiftDay(sourceToday(connection.sourceTimezone), -1);
        try {
          await this.sync(
            connection.id,
            { from: shiftDay(to, -6), to },
            connection.configuredByUserId,
            true,
          );
        } catch {
          /* Another process may have claimed the same due connection. No provider errors are logged. */
        }
      }
    } finally {
      this.ticking = false;
    }
  }
}
