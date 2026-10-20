import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountAnalyticsDataScope,
  AccountAnalyticsScope,
  IntegrationProvider,
  MetricUnit,
  type Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import type { ConnectedAccountProvider } from '../accounts/account-contract.js';
import type { AccountAnalyticsQueryDto } from './account-analytics.dto.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const isLinkedInProvider = (provider: IntegrationProvider) =>
  provider === IntegrationProvider.LINKEDIN_ADS ||
  provider === IntegrationProvider.LINKEDIN_ORGANIC;
const metricExpiryWhere = (at: Date) => ({
  OR: [{ sourceDataExpiresAt: null }, { sourceDataExpiresAt: { gt: at } }],
});
const parseDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
    ? null
    : parsed;
};

export type AccountAnalyticsObservation = {
  date: string;
  scope?: 'ACCOUNT' | 'CONTENT' | 'EMAIL_CAMPAIGN';
  sourceObjectId?: string;
  sourceObservationKey?: string;
  objectTitle?: string | null;
  objectType?: string | null;
  objectUrl?: string | null;
  objectOccurredAt?: Date | null;
  periodFrom?: string | null;
  periodTo?: string | null;
  dataScope?: 'LIFETIME' | 'DATE_RANGE' | 'CUMULATIVE' | null;
  values: Record<string, number>;
};

const connectedProviderMap: Record<
  ConnectedAccountProvider,
  IntegrationProvider
> = {
  INSTAGRAM: IntegrationProvider.INSTAGRAM_ORGANIC,
  FACEBOOK: IntegrationProvider.FACEBOOK_ORGANIC,
  LINKEDIN: IntegrationProvider.LINKEDIN_ORGANIC,
  YOUTUBE: IntegrationProvider.YOUTUBE_ANALYTICS,
  ZOHO_CAMPAIGNS: IntegrationProvider.ZOHO_CAMPAIGNS,
};

@Injectable()
export class AccountAnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async ingest(
    connectionId: string,
    observations: AccountAnalyticsObservation[],
    sourceApiVersion?: string,
    retrievedAt = new Date(),
  ) {
    if (observations.length > 366)
      throw new BadRequestException({
        code: 'INVALID_ACCOUNT_OBSERVATIONS',
        message: 'Provide no more than 366 daily account observations.',
      });
    if (
      sourceApiVersion !== undefined &&
      (!sourceApiVersion.trim() || sourceApiVersion.length > 40)
    )
      throw new BadRequestException({
        code: 'INVALID_SOURCE_API_VERSION',
        message: 'The source API version is invalid.',
      });

    const connection = await this.prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, provider: true, active: true },
    });
    if (!connection)
      throw new NotFoundException({
        code: 'INTEGRATION_NOT_FOUND',
        message: 'Integration connection not found.',
      });
    if (!connection.active)
      throw new BadRequestException({
        code: 'INTEGRATION_DISCONNECTED',
        message: 'Disconnected accounts cannot receive new analytics data.',
      });
    if (!observations.length) return { created: 0, updated: 0, unchanged: 0 };

    const uniqueKeys = new Set<string>();
    const requestedCodes = new Set<string>();
    const requestedScopes = new Set<AccountAnalyticsScope>();
    for (const observation of observations) {
      const date = parseDate(observation.date);
      const scope = observation.scope ?? 'ACCOUNT';
      const subjectId = observation.sourceObjectId ?? 'ACCOUNT';
      if (
        !date ||
        !['ACCOUNT', 'CONTENT'].includes(scope) ||
        !Object.keys(observation.values).length ||
        (scope === 'ACCOUNT' && subjectId !== 'ACCOUNT') ||
        (scope === 'CONTENT' &&
          (!subjectId.trim() ||
            subjectId === 'ACCOUNT' ||
            subjectId.length > 160))
      )
        throw new BadRequestException({
          code: 'INVALID_ACCOUNT_OBSERVATION',
          message:
            'Each observation needs a valid date, source scope, object identity, and at least one metric.',
        });
      const uniqueKey = `${observation.date}|${scope}|${subjectId}`;
      if (uniqueKeys.has(uniqueKey))
        throw new BadRequestException({
          code: 'DUPLICATE_ACCOUNT_OBSERVATION',
          message: 'The provider returned duplicate daily observations.',
        });
      uniqueKeys.add(uniqueKey);
      requestedScopes.add(scope as AccountAnalyticsScope);
      Object.keys(observation.values).forEach((code) =>
        requestedCodes.add(code),
      );
    }

    const definitions = await this.prisma.integrationMetricDefinition.findMany({
      where: {
        provider: connection.provider,
        code: { in: [...requestedCodes] },
        scope: { in: [...requestedScopes] },
        active: true,
      },
    });
    const metricKey = (scope: string, code: string) => `${scope}:${code}`;
    const byMetric = new Map(
      definitions.map((definition) => [
        metricKey(definition.scope, definition.code),
        definition,
      ]),
    );
    const requestedMetricKeys = new Set(
      observations.flatMap((observation) =>
        Object.keys(observation.values).map((code) =>
          metricKey(observation.scope ?? 'ACCOUNT', code),
        ),
      ),
    );
    if ([...requestedMetricKeys].some((key) => !byMetric.has(key)))
      throw new BadRequestException({
        code: 'UNSUPPORTED_PROVIDER_METRIC',
        message:
          'The provider returned a metric without an approved provider-specific definition.',
      });
    if (definitions.length !== requestedMetricKeys.size)
      throw new BadRequestException({
        code: 'AMBIGUOUS_PROVIDER_METRIC_DEFINITION',
        message:
          'The provider metric has more than one active definition version.',
      });
    if (
      isLinkedInProvider(connection.provider) &&
      definitions.some((definition) => definition.retentionDays === null)
    )
      throw new BadRequestException({
        code: 'PROVIDER_RETENTION_POLICY_MISSING',
        message:
          'Every LinkedIn reporting metric needs an explicit retention policy before it can be stored.',
      });

    for (const observation of observations)
      for (const [code, value] of Object.entries(observation.values)) {
        const definition = byMetric.get(
          metricKey(observation.scope ?? 'ACCOUNT', code),
        )!;
        if (
          !Number.isFinite(value) ||
          Math.abs(value) > Number.MAX_SAFE_INTEGER ||
          (definition.nonNegative && value < 0) ||
          (definition.unit === MetricUnit.COUNT && !Number.isInteger(value))
        )
          throw new BadRequestException({
            code: 'INVALID_PROVIDER_METRIC',
            message: 'The provider returned an invalid raw metric value.',
          });
      }

    const definition = (scope: string, code: string) =>
      byMetric.get(metricKey(scope, code))!;
    const expiresAt = (scope: string, code: string) => {
      const retentionDays = definition(scope, code).retentionDays;
      return retentionDays === null
        ? null
        : new Date(retrievedAt.getTime() + retentionDays * DAY_MS);
    };
    return this.prisma.$transaction(async (tx) => {
      const counts = { created: 0, updated: 0, unchanged: 0 };
      for (const observation of observations) {
        const recordDate = parseDate(observation.date)!;
        const scope = observation.scope ?? 'ACCOUNT';
        const sourceObjectId = observation.sourceObjectId ?? 'ACCOUNT';
        const existing = await tx.connectedAccountAnalyticsRecord.findUnique({
          where: {
            connectionId_recordDate_scope_sourceObjectId: {
              connectionId,
              recordDate,
              scope,
              sourceObjectId,
            },
          },
          include: {
            metricValues: { include: { metricDefinition: true } },
          },
        });
        const oldValues = new Map(
          (existing?.metricValues ?? []).map((item) => [
            item.metricDefinition.code,
            {
              value: Number(item.value),
              metricDefinitionId: item.metricDefinitionId,
            },
          ]),
        );
        const nextValues = Object.entries(observation.values);
        const unchanged =
          oldValues.size === nextValues.length &&
          nextValues.every(([code, value]) => {
            const previous = oldValues.get(code);
            return (
              previous?.value === value &&
              previous.metricDefinitionId === definition(scope, code).id
            );
          });
        const record = existing
          ? await tx.connectedAccountAnalyticsRecord.update({
              where: { id: existing.id },
              data: {
                retrievedAt,
                sourceApiVersion:
                  sourceApiVersion ?? existing.sourceApiVersion ?? null,
              },
            })
          : await tx.connectedAccountAnalyticsRecord.create({
              data: {
                connectionId,
                recordDate,
                scope,
                sourceObjectId,
                retrievedAt,
                sourceApiVersion: sourceApiVersion ?? null,
              },
            });

        if (unchanged) {
          for (const [code] of nextValues)
            await tx.connectedAccountMetricValue.update({
              where: {
                recordId_metricDefinitionId: {
                  recordId: record.id,
                  metricDefinitionId: definition(scope, code).id,
                },
              },
              data: { sourceDataExpiresAt: expiresAt(scope, code) },
            });
          counts.unchanged++;
          continue;
        }
        if (existing)
          await tx.connectedAccountMetricValue.deleteMany({
            where: { recordId: record.id },
          });
        await tx.connectedAccountMetricValue.createMany({
          data: nextValues.map(([code, value]) => ({
            recordId: record.id,
            metricDefinitionId: definition(scope, code).id,
            value,
            sourceDataExpiresAt: expiresAt(scope, code),
          })),
        });
        if (existing) counts.updated++;
        else counts.created++;
      }
      return counts;
    });
  }

  async ingestConnectedAccount(
    connectedAccountId: string,
    provider: ConnectedAccountProvider,
    observations: AccountAnalyticsObservation[],
    sourceApiVersion?: string,
    retrievedAt = new Date(),
    writeGuard?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    if (observations.length > 1000)
      throw new BadRequestException({
        code: 'INVALID_ACCOUNT_OBSERVATIONS',
        message:
          'Provide no more than 1,000 account, content, or campaign observations.',
      });
    if (
      sourceApiVersion !== undefined &&
      (!sourceApiVersion.trim() || sourceApiVersion.length > 80)
    )
      throw new BadRequestException({
        code: 'INVALID_SOURCE_API_VERSION',
        message: 'The source API version is invalid.',
      });
    const account = await this.prisma.connectedAccount.findUnique({
      where: { id: connectedAccountId },
      select: { id: true, provider: true, active: true },
    });
    if (!account || account.provider !== provider)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Connected account not found.',
      });
    if (!account.active)
      throw new BadRequestException({
        code: 'ACCOUNT_DISCONNECTED',
        message: 'Disconnected accounts cannot receive new analytics data.',
      });
    if (!observations.length) return { created: 0, updated: 0, unchanged: 0 };

    const integrationProvider = connectedProviderMap[provider];
    const uniqueKeys = new Set<string>();
    const requestedMetricKeys = new Set<string>();
    const scopes = new Set<AccountAnalyticsScope>();
    for (const observation of observations) {
      const date = parseDate(observation.date);
      const scope = observation.scope ?? 'ACCOUNT';
      const sourceObjectId = observation.sourceObjectId ?? 'ACCOUNT';
      const sourceObservationKey = observation.sourceObservationKey;
      // Meta can return a readable post without an available insights metric.
      // Preserve its metadata without fabricating a zero or failing the whole
      // account sync. Account observations still require actual metric values.
      const metaContentWithoutMetrics =
        scope === 'CONTENT' &&
        (provider === 'FACEBOOK' || provider === 'INSTAGRAM');
      if (
        !date ||
        (!Object.keys(observation.values).length &&
          !metaContentWithoutMetrics) ||
        !sourceObservationKey ||
        sourceObservationKey.length > 512 ||
        (scope === 'ACCOUNT' &&
          (sourceObjectId !== 'ACCOUNT' || observation.dataScope != null)) ||
        (scope === 'CONTENT' &&
          (!sourceObjectId.trim() ||
            sourceObjectId === 'ACCOUNT' ||
            !['LIFETIME', 'DATE_RANGE'].includes(
              observation.dataScope ?? '',
            ))) ||
        (scope === 'EMAIL_CAMPAIGN' &&
          (!sourceObjectId.trim() ||
            sourceObjectId === 'ACCOUNT' ||
            observation.dataScope !== 'CUMULATIVE')) ||
        (scope !== 'ACCOUNT' &&
          scope !== 'CONTENT' &&
          scope !== 'EMAIL_CAMPAIGN') ||
        ((observation.periodFrom || observation.periodTo) &&
          (!observation.periodFrom ||
            !observation.periodTo ||
            !parseDate(observation.periodFrom) ||
            !parseDate(observation.periodTo) ||
            parseDate(observation.periodFrom)! >
              parseDate(observation.periodTo)!))
      )
        throw new BadRequestException({
          code: 'INVALID_ACCOUNT_OBSERVATION',
          message:
            'Each observation needs a valid date, scope, identity, source key, and provider data scope.',
        });
      if (uniqueKeys.has(sourceObservationKey))
        throw new BadRequestException({
          code: 'DUPLICATE_ACCOUNT_OBSERVATION',
          message: 'The provider returned duplicate observations.',
        });
      uniqueKeys.add(sourceObservationKey);
      scopes.add(scope as AccountAnalyticsScope);
      for (const code of Object.keys(observation.values))
        requestedMetricKeys.add(`${scope}:${code}`);
    }

    const requestedCodes = [
      ...new Set(
        [...requestedMetricKeys].map((key) => key.slice(key.indexOf(':') + 1)),
      ),
    ];
    const definitions = await this.prisma.integrationMetricDefinition.findMany({
      where: {
        provider: integrationProvider,
        code: { in: requestedCodes },
        scope: { in: [...scopes] },
        active: true,
      },
    });
    const byMetric = new Map(
      definitions.map((definition) => [
        `${definition.scope}:${definition.code}`,
        definition,
      ]),
    );
    if ([...requestedMetricKeys].some((key) => !byMetric.has(key)))
      throw new BadRequestException({
        code: 'UNSUPPORTED_PROVIDER_METRIC',
        message:
          'The provider returned a metric without an approved provider-specific definition.',
      });
    if (definitions.length !== requestedMetricKeys.size)
      throw new BadRequestException({
        code: 'AMBIGUOUS_PROVIDER_METRIC_DEFINITION',
        message:
          'The provider metric has more than one active definition version.',
      });
    if (
      integrationProvider === IntegrationProvider.LINKEDIN_ORGANIC &&
      definitions.some((definition) => definition.retentionDays === null)
    )
      throw new BadRequestException({
        code: 'PROVIDER_RETENTION_POLICY_MISSING',
        message:
          'Every LinkedIn reporting metric needs an explicit retention policy before it can be stored.',
      });
    for (const observation of observations)
      for (const [code, value] of Object.entries(observation.values)) {
        const definition = byMetric.get(
          `${observation.scope ?? 'ACCOUNT'}:${code}`,
        )!;
        if (
          !Number.isFinite(value) ||
          Math.abs(value) > Number.MAX_SAFE_INTEGER ||
          (definition.nonNegative && value < 0) ||
          (definition.unit === MetricUnit.COUNT && !Number.isInteger(value))
        )
          throw new BadRequestException({
            code: 'INVALID_PROVIDER_METRIC',
            message: 'The provider returned an invalid raw metric value.',
          });
      }

    return this.prisma.$transaction(async (tx) => {
      if (writeGuard) await writeGuard(tx);
      const counts = { created: 0, updated: 0, unchanged: 0 };
      for (const observation of observations) {
        const scope = observation.scope ?? 'ACCOUNT';
        const sourceObjectId = observation.sourceObjectId ?? 'ACCOUNT';
        const sourceObservationKey = observation.sourceObservationKey!;
        const recordDate = parseDate(observation.date)!;
        const existing = await tx.connectedAccountAnalyticsRecord.findUnique({
          where: {
            connectedAccountId_sourceObservationKey: {
              connectedAccountId,
              sourceObservationKey,
            },
          },
          include: { metricValues: { include: { metricDefinition: true } } },
        });
        const oldValues = new Map(
          (existing?.metricValues ?? []).map((item) => [
            item.metricDefinition.code,
            {
              value: Number(item.value),
              metricDefinitionId: item.metricDefinitionId,
            },
          ]),
        );
        const values = Object.entries(observation.values);
        const unchanged =
          oldValues.size === values.length &&
          values.every(([code, value]) => {
            const previous = oldValues.get(code);
            return (
              previous?.value === value &&
              previous.metricDefinitionId ===
                byMetric.get(`${scope}:${code}`)!.id
            );
          });
        const recordData = {
          recordDate,
          scope,
          sourceObjectId,
          objectTitle: observation.objectTitle ?? null,
          objectType: observation.objectType ?? null,
          objectUrl: observation.objectUrl ?? null,
          objectOccurredAt: observation.objectOccurredAt ?? null,
          periodFrom: observation.periodFrom
            ? parseDate(observation.periodFrom)
            : null,
          periodTo: observation.periodTo
            ? parseDate(observation.periodTo)
            : null,
          dataScope: observation.dataScope
            ? (observation.dataScope as AccountAnalyticsDataScope)
            : null,
          retrievedAt,
          sourceApiVersion:
            sourceApiVersion ?? existing?.sourceApiVersion ?? null,
        };
        const record = existing
          ? await tx.connectedAccountAnalyticsRecord.update({
              where: { id: existing.id },
              data: recordData,
            })
          : await tx.connectedAccountAnalyticsRecord.create({
              data: { connectedAccountId, sourceObservationKey, ...recordData },
            });
        if (unchanged) {
          for (const [code] of values) {
            const definition = byMetric.get(`${scope}:${code}`)!;
            await tx.connectedAccountMetricValue.update({
              where: {
                recordId_metricDefinitionId: {
                  recordId: record.id,
                  metricDefinitionId: definition.id,
                },
              },
              data: {
                sourceDataExpiresAt:
                  definition.retentionDays === null
                    ? null
                    : new Date(
                        retrievedAt.getTime() +
                          definition.retentionDays * DAY_MS,
                      ),
              },
            });
          }
          counts.unchanged++;
          continue;
        }
        if (existing)
          await tx.connectedAccountMetricValue.deleteMany({
            where: { recordId: record.id },
          });
        await tx.connectedAccountMetricValue.createMany({
          data: values.map(([code, value]) => {
            const definition = byMetric.get(`${scope}:${code}`)!;
            return {
              recordId: record.id,
              metricDefinitionId: definition.id,
              value,
              sourceDataExpiresAt:
                definition.retentionDays === null
                  ? null
                  : new Date(
                      retrievedAt.getTime() + definition.retentionDays * DAY_MS,
                    ),
            };
          }),
        });
        if (existing) counts.updated++;
        else counts.created++;
      }
      return counts;
    });
  }

  async list(connectionId: string, query: AccountAnalyticsQueryDto) {
    const from = parseDate(query.from);
    const to = parseDate(query.to);
    const scope = query.scope ?? 'ACCOUNT';
    const maxRangeMs = (scope === 'CONTENT' ? 30 : 365) * DAY_MS;
    if (!from || !to || from > to || to.getTime() - from.getTime() > maxRangeMs)
      throw new BadRequestException({
        code: 'INVALID_ACCOUNT_ANALYTICS_RANGE',
        message:
          scope === 'CONTENT'
            ? 'Choose a valid content analytics date range of no more than 31 days.'
            : 'Choose a valid account analytics date range of no more than 366 days.',
      });
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        provider: true,
        displayName: true,
        platform: { select: { id: true, name: true } },
      },
    });
    if (!connection)
      throw new NotFoundException({
        code: 'INTEGRATION_NOT_FOUND',
        message: 'Integration connection not found.',
      });
    const now = new Date();
    const records = await this.prisma.connectedAccountAnalyticsRecord.findMany({
      where: {
        connectionId,
        recordDate: { gte: from, lte: to },
        scope,
        metricValues: { some: metricExpiryWhere(now) },
      },
      include: {
        metricValues: {
          where: metricExpiryWhere(now),
          include: { metricDefinition: true },
          orderBy: { metricDefinition: { code: 'asc' } },
        },
      },
      orderBy: [
        { recordDate: 'asc' },
        { scope: 'asc' },
        { sourceObjectId: 'asc' },
      ],
    });
    return {
      connection,
      filters: { from: query.from, to: query.to, scope },
      records: records.map((record) => ({
        date: record.recordDate.toISOString().slice(0, 10),
        scope: record.scope,
        sourceObjectId:
          record.scope === AccountAnalyticsScope.ACCOUNT
            ? null
            : record.sourceObjectId,
        sourceApiVersion: record.sourceApiVersion,
        retrievedAt: record.retrievedAt.toISOString(),
        metrics: record.metricValues.map((item) => ({
          code: item.metricDefinition.code,
          name: item.metricDefinition.name,
          meaning: item.metricDefinition.description,
          sourceField: item.metricDefinition.sourceField,
          definitionVersion: item.metricDefinition.definitionVersion,
          unit: item.metricDefinition.unit,
          aggregationStrategy: item.metricDefinition.aggregationStrategy,
          weightingMetricCode: item.metricDefinition.weightingMetricCode,
          value: Number(item.value),
        })),
      })),
    };
  }

  async purgeExpired(at = new Date()) {
    return this.prisma.$transaction(async (tx) => {
      const campaignValues = await tx.performanceMetricValue.deleteMany({
        where: {
          sourceDataExpiresAt: { lte: at },
        },
      });
      const accountValues = await tx.connectedAccountMetricValue.deleteMany({
        where: {
          sourceDataExpiresAt: { lte: at },
        },
      });
      const emptyRecords = await tx.connectedAccountAnalyticsRecord.deleteMany({
        where: {
          metricValues: { none: {} },
        },
      });
      return {
        campaignValues: campaignValues.count,
        accountValues: accountValues.count,
        emptyRecords: emptyRecords.count,
      };
    });
  }
}
