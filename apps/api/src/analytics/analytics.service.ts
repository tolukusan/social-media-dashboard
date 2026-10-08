import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { isUUID } from 'class-validator';
import {
  calculateKpis,
  comparisonPeriods,
  percentageChange,
  resolveTarget,
  targetStatus,
  trendGrain,
  type TargetCandidate,
  type RawMetricRow,
} from './calculations.js';
import type { DashboardQueryDto } from './dto/dashboard-query.dto.js';
import type { DashboardResponse } from '@smd/shared';

export function buildDashboardWhere(query: DashboardQueryDto) {
  const campaignChannel: Record<string, string> = {};
  if (query.campaignId) campaignChannel.campaignId = query.campaignId;
  if (query.channelId) campaignChannel.channelId = query.channelId;

  const campaignPlatform: Record<string, unknown> = {};
  if (Object.keys(campaignChannel).length)
    campaignPlatform.campaignChannel = campaignChannel;
  if (query.platformId) campaignPlatform.platformId = query.platformId;

  const recordDate: Record<string, Date> = {};
  if (query.from) recordDate.gte = startOfDay(query.from);
  if (query.to) recordDate.lte = endOfDay(query.to);

  return {
    status: 'ACTIVE' as const,
    ...(Object.keys(recordDate).length ? { recordDate } : {}),
    ...(Object.keys(campaignPlatform).length ? { campaignPlatform } : {}),
  };
}

function startOfDay(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function endOfDay(value: string) {
  return new Date(`${value.slice(0, 10)}T23:59:59.999Z`);
}

function validateDateRange(query: DashboardQueryDto) {
  if (query.from && query.to && startOfDay(query.from) > endOfDay(query.to))
    throw new BadRequestException({
      code: 'INVALID_ANALYTICS_DATE_RANGE',
      message: 'The analytics start date cannot be after the end date',
    });
}

function scopedCalculation(
  calculation: ReturnType<typeof calculateKpis>,
  metricCode?: string,
) {
  if (!metricCode) return calculation;
  const rawValue = calculation.rawTotals[metricCode];
  const derivedValue = calculation.derived[metricCode];
  const value = rawValue ?? derivedValue ?? null;
  return {
    rawTotals: rawValue === undefined ? {} : { [metricCode]: rawValue },
    derived: derivedValue === undefined ? {} : { [metricCode]: derivedValue },
    kpis: { [metricCode]: value },
  };
}

function validateMetricCode(
  query: DashboardQueryDto,
  definitions: Array<{ code: string }>,
) {
  if (
    query.metricCode &&
    !definitions.some((item) => item.code === query.metricCode)
  )
    throw new BadRequestException({
      code: 'UNKNOWN_ANALYTICS_METRIC',
      message: 'The selected metric is not an active approved metric.',
    });
}

function targetPeriodBounds(
  query: DashboardQueryDto,
  campaign?: { startDate: Date; endDate: Date | null },
) {
  const type = query.targetPeriod;
  if (!type) return null;
  if (type === 'CAMPAIGN') {
    if (!campaign || query.from || query.to)
      throw new BadRequestException({
        code: 'TARGET_PERIOD_MISMATCH',
        message:
          'Campaign targets require an unbounded lifetime query for one campaign.',
      });
    return {
      from: campaign.startDate,
      to:
        campaign.endDate && campaign.endDate < new Date()
          ? campaign.endDate
          : new Date(),
    };
  }
  if (!query.from || !query.to)
    throw new BadRequestException({
      code: 'TARGET_PERIOD_MISMATCH',
      message: 'Target evaluation requires a complete matching date period.',
    });
  const from = startOfDay(query.from);
  const to = endOfDay(query.to);
  let expectedFrom = from;
  let expectedTo = to;
  if (type === 'DAILY') expectedTo = endOfDay(query.from);
  if (type === 'WEEKLY') {
    const day = from.getUTCDay() || 7;
    expectedFrom = new Date(from);
    expectedFrom.setUTCDate(expectedFrom.getUTCDate() - day + 1);
    expectedTo = endOfDay(
      new Date(expectedFrom.getTime() + 6 * 86_400_000).toISOString(),
    );
  }
  if (type === 'MONTHLY') {
    expectedFrom = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
    );
    expectedTo = endOfDay(
      new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0),
      ).toISOString(),
    );
  }
  if (type === 'QUARTERLY') {
    const month = Math.floor(from.getUTCMonth() / 3) * 3;
    expectedFrom = new Date(Date.UTC(from.getUTCFullYear(), month, 1));
    expectedTo = endOfDay(
      new Date(Date.UTC(from.getUTCFullYear(), month + 3, 0)).toISOString(),
    );
  }
  if (type === 'YEARLY') {
    expectedFrom = new Date(Date.UTC(from.getUTCFullYear(), 0, 1));
    expectedTo = endOfDay(
      new Date(Date.UTC(from.getUTCFullYear(), 11, 31)).toISOString(),
    );
  }
  if (
    from.getTime() !== expectedFrom.getTime() ||
    to.getTime() !== expectedTo.getTime()
  )
    throw new BadRequestException({
      code: 'TARGET_PERIOD_MISMATCH',
      message:
        'Selected dates must match the complete target evaluation period.',
    });
  return { from, to };
}

@Injectable()
export class AnalyticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dashboard(query: DashboardQueryDto): Promise<DashboardResponse> {
    validateDateRange(query);

    const [records, definitions, reportingSettings] = await Promise.all([
      this.prisma.performanceRecord.findMany({
        where: buildDashboardWhere(query),
        include: {
          metricValues: { include: { metricDefinition: true } },
          campaignPlatform: {
            include: {
              platform: true,
              campaignChannel: {
                include: { channel: true, campaign: true },
              },
            },
          },
        },
        orderBy: [{ recordDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.metricDefinition.findMany({
        where: { active: true },
        select: {
          code: true,
          name: true,
          unit: true,
          kind: true,
          aggregationStrategy: true,
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.reportingSettings.findUnique({
        where: { id: 'organisation' },
      }),
    ]);
    validateMetricCode(query, definitions);
    const channelMetricLinks = await this.prisma.channelMetric.findMany({
      where: {
        active: true,
        channel: { active: true },
        metricDefinition: { active: true },
      },
      select: { channelId: true, metricDefinition: { select: { code: true } } },
    });
    const applicableChannelIds = new Map<string, string[]>();
    for (const link of channelMetricLinks) {
      const channelIds =
        applicableChannelIds.get(link.metricDefinition.code) ?? [];
      channelIds.push(link.channelId);
      applicableChannelIds.set(link.metricDefinition.code, channelIds);
    }
    const rows: RawMetricRow[] = records.map((record) =>
      Object.fromEntries(
        record.metricValues.map((metric) => [
          metric.metricDefinition.code,
          Number(metric.value),
        ]),
      ),
    );
    const calculations = scopedCalculation(
      calculateKpis(rows, definitions),
      query.metricCode,
    );

    let targetEvaluations: DashboardResponse['targetEvaluations'];
    if (query.targetPeriod) {
      const campaign =
        query.targetPeriod === 'CAMPAIGN' && query.campaignId
          ? await this.prisma.campaign.findUnique({
              where: { id: query.campaignId },
              select: { startDate: true, endDate: true },
            })
          : undefined;
      if (query.targetPeriod === 'CAMPAIGN' && !campaign)
        throw new BadRequestException({
          code: 'TARGET_PERIOD_MISMATCH',
          message: 'Campaign target evaluation requires an existing campaign.',
        });
      const evaluationPeriod = targetPeriodBounds(query, campaign ?? undefined);
      if (!evaluationPeriod) throw new Error('Target period was not resolved.');
      const kpiDefinitions = await this.prisma.kpiDefinition.findMany({
        where: {
          active: true,
          metricDefinition: {
            active: true,
            ...(query.metricCode ? { code: query.metricCode } : {}),
          },
        },
        include: { metricDefinition: true },
      });
      const targetRows = await this.prisma.kpiTarget.findMany({
        where: {
          periodType: query.targetPeriod as never,
          effectiveFrom: { lte: evaluationPeriod.from },
          OR: [
            { effectiveTo: null },
            {
              effectiveTo: {
                gte: startOfDay(evaluationPeriod.to.toISOString()),
              },
            },
          ],
          kpiDefinition: {
            active: true,
            metricDefinition: { active: true },
          },
        },
        include: { kpiDefinition: { include: { metricDefinition: true } } },
      });
      targetEvaluations = Object.fromEntries(
        kpiDefinitions.map((definition) => {
          const code = definition.metricDefinition.code;
          const candidates = targetRows
            .filter(
              (target) => target.kpiDefinition.metricDefinition.code === code,
            )
            .map((target) => ({
              ...target,
              targetValue: Number(target.targetValue),
            })) as TargetCandidate[];
          const target = resolveTarget(
            candidates,
            {
              campaignId: query.campaignId,
              channelId: query.channelId,
              platformId: query.platformId,
            },
            query.targetPeriod!,
            evaluationPeriod.to,
            evaluationPeriod,
          );
          const actual = calculations.kpis[code] ?? null;
          const status = targetStatus(actual, target);
          return [
            code,
            {
              actual,
              target: target
                ? {
                    id: target.id,
                    value: target.targetValue,
                    comparisonRule: target.comparisonRule,
                    scopeType: target.scopeType,
                    periodType: target.periodType,
                    effectiveFrom: target.effectiveFrom.toISOString(),
                    effectiveTo: target.effectiveTo?.toISOString() ?? null,
                  }
                : null,
              status,
            },
          ];
        }),
      );
    }

    const campaignIds = new Set(
      records
        .filter(
          (record) =>
            !record.campaignPlatform.campaignChannel.campaign.archivedAt,
        )
        .map((record) => record.campaignPlatform.campaignChannel.campaignId),
    );
    const channelIds = new Set(
      records
        .filter(
          (record) => record.campaignPlatform.campaignChannel.channel.active,
        )
        .map((record) => record.campaignPlatform.campaignChannel.channelId),
    );
    return {
      filters: {
        from: query.from ?? null,
        to: query.to ?? null,
        campaignId: query.campaignId ?? null,
        channelId: query.channelId ?? null,
        platformId: query.platformId ?? null,
        metricCode: query.metricCode ?? null,
        targetPeriod: query.targetPeriod ?? null,
      },
      recordCount: records.length,
      campaignCount: campaignIds.size,
      channelCount: channelIds.size,
      rawTotals: calculations.rawTotals,
      derived: calculations.derived,
      kpis: calculations.kpis,
      metricMetadata: definitions.map((definition) => ({
        code: definition.code,
        label:
          definition.code === 'SM_REACH'
            ? 'Aggregated daily reach'
            : definition.name,
        unit: definition.unit,
        kind: definition.kind,
        aggregationStrategy: definition.aggregationStrategy,
        applicableChannelIds: applicableChannelIds.get(definition.code) ?? [],
        ...(definition.code === 'SM_REACH'
          ? {
              aggregationNote:
                'Daily totals may include repeat people across days and are not a deduplicated unique period audience.',
            }
          : {}),
      })),
      ...(targetEvaluations ? { targetEvaluations } : {}),
      reportingContext: {
        currencyCode: reportingSettings?.reportingCurrency ?? null,
        timeZone: process.env.REPORTING_TIMEZONE || null,
      },
    };
  }

  async trends(query: DashboardQueryDto) {
    if (!query.from || !query.to)
      throw new BadRequestException({
        code: 'TREND_DATE_RANGE_REQUIRED',
        message: 'Trend queries require from and to dates',
      });
    validateDateRange(query);
    const [records, definitions] = await Promise.all([
      this.prisma.performanceRecord.findMany({
        where: buildDashboardWhere(query),
        include: { metricValues: { include: { metricDefinition: true } } },
        orderBy: [{ recordDate: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.metricDefinition.findMany({
        where: { active: true },
        select: {
          code: true,
          name: true,
          unit: true,
          kind: true,
          aggregationStrategy: true,
        },
      }),
    ]);
    validateMetricCode(query, definitions);
    const grain = trendGrain(startOfDay(query.from), endOfDay(query.to));
    const buckets = new Map<string, RawMetricRow[]>();
    const first = startOfDay(query.from);
    const last = endOfDay(query.to);
    const cursor = new Date(first);
    if (grain === 'WEEKLY') {
      const day = cursor.getUTCDay() || 7;
      cursor.setUTCDate(cursor.getUTCDate() - day + 1);
    } else if (grain === 'MONTHLY') cursor.setUTCDate(1);
    while (cursor <= last) {
      buckets.set(bucketKey(cursor, grain), []);
      if (grain === 'DAILY') cursor.setUTCDate(cursor.getUTCDate() + 1);
      else if (grain === 'WEEKLY') cursor.setUTCDate(cursor.getUTCDate() + 7);
      else cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    for (const record of records) {
      const key = bucketKey(record.recordDate, grain);
      const rows = buckets.get(key) ?? [];
      rows.push(
        Object.fromEntries(
          record.metricValues.map((metric) => [
            metric.metricDefinition.code,
            Number(metric.value),
          ]),
        ),
      );
      buckets.set(key, rows);
    }
    const emptyCalculation = calculateKpis([], definitions);
    return {
      grain,
      points: [...buckets.entries()].map(([bucket, rows]) => ({
        bucket,
        ...scopedCalculation(
          rows.length ? calculateKpis(rows, definitions) : emptyCalculation,
          query.metricCode,
        ),
      })),
    };
  }

  async comparison(query: DashboardQueryDto) {
    if (!query.from || !query.to)
      throw new BadRequestException({
        code: 'COMPARISON_DATE_RANGE_REQUIRED',
        message: 'Comparison queries require from and to dates',
      });
    validateDateRange(query);
    const periods = comparisonPeriods(
      startOfDay(query.from),
      endOfDay(query.to),
      query.comparisonPeriod ?? 'CUSTOM',
    );
    const previousQuery = {
      ...query,
      from: periods.previous.from.toISOString(),
      to: periods.previous.to.toISOString(),
      targetPeriod: undefined,
    };
    const currentQuery = {
      ...query,
      from: periods.current.from.toISOString(),
      to: periods.current.to.toISOString(),
      targetPeriod: undefined,
    };
    const [current, previous] = await Promise.all([
      this.dashboard(currentQuery),
      this.dashboard(previousQuery),
    ]);
    const difference: Record<string, number | null> = {};
    for (const code of new Set([
      ...Object.keys(current.kpis),
      ...Object.keys(previous.kpis),
    ])) {
      const currentValue = current.kpis[code];
      const previousValue = previous.kpis[code];
      difference[code] =
        currentValue == null || previousValue == null
          ? null
          : currentValue - previousValue;
    }
    const percentageChanges: Record<string, number | null> = {};
    for (const code of Object.keys(difference))
      percentageChanges[code] = percentageChange(
        current.kpis[code] ?? null,
        previous.kpis[code] ?? null,
      );
    return {
      type: periods.type,
      isPartial: periods.isPartial,
      currentPeriod: periods.current,
      previousPeriod: periods.previous,
      current,
      previous,
      difference,
      percentageChange: percentageChanges,
    };
  }

  async dimensionComparison(query: DashboardQueryDto) {
    const ids = (query.dimensionIds ?? '').split(',').map((id) => id.trim());
    if (
      !query.dimension ||
      ids.length < 2 ||
      ids.length > 8 ||
      ids.some((id) => !isUUID(id)) ||
      new Set(ids).size !== ids.length ||
      !query.metricCode
    )
      throw new BadRequestException({
        code: 'INVALID_DIMENSION_COMPARISON',
        message: 'Choose 2 to 8 distinct items and one approved metric.',
      });
    const lifetime = query.comparisonMode === 'LIFETIME';
    if (!lifetime && (!query.from || !query.to))
      throw new BadRequestException({
        code: 'COMPARISON_DATE_RANGE_REQUIRED',
        message: 'Period comparisons require from and to dates.',
      });
    const filters = {
      ...query,
      from: lifetime ? undefined : query.from,
      to: lifetime ? undefined : query.to,
      metricCode: query.metricCode,
      targetPeriod: undefined,
    };
    let labels = new Map<string, string>();
    let durations = new Map<string, number>();
    if (query.dimension === 'CAMPAIGN') {
      const campaigns = await this.prisma.campaign.findMany({
        where: { id: { in: ids }, archivedAt: null },
        select: { id: true, name: true, startDate: true, endDate: true },
      });
      if (campaigns.length !== ids.length)
        throw new BadRequestException({
          code: 'INVALID_COMPARISON_CAMPAIGN',
          message: 'Every selected campaign must exist and be active.',
        });
      labels = new Map(campaigns.map((item) => [item.id, item.name]));
      durations = new Map(
        campaigns.map((item) => [
          item.id,
          Math.floor(
            ((item.endDate ?? new Date()).getTime() -
              item.startDate.getTime()) /
              86_400_000,
          ) + 1,
        ]),
      );
    } else {
      const channels = await this.prisma.marketingChannel.findMany({
        where: {
          id: { in: ids },
          active: true,
          channelMetrics: {
            some: {
              active: true,
              metricDefinition: { code: query.metricCode, active: true },
            },
          },
        },
        select: { id: true, name: true },
      });
      if (channels.length !== ids.length)
        throw new BadRequestException({
          code: 'INCOMPATIBLE_CHANNEL_METRIC',
          message:
            'The selected metric must be active and applicable to every selected channel.',
        });
      labels = new Map(channels.map((item) => [item.id, item.name]));
    }
    const results = await Promise.all(
      ids.map(async (id) => {
        const result = await this.dashboard({
          ...filters,
          ...(query.dimension === 'CAMPAIGN'
            ? { campaignId: id }
            : { channelId: id }),
        });
        return {
          id,
          label: labels.get(id),
          value: result.kpis[query.metricCode!] ?? null,
          unit: result.metricMetadata.find(
            (metric) => metric.code === query.metricCode,
          )?.unit,
          ...(lifetime && query.dimension === 'CAMPAIGN'
            ? { durationDays: durations.get(id) }
            : {}),
        };
      }),
    );
    return {
      dimension: query.dimension,
      mode: lifetime ? 'LIFETIME' : 'PERIOD',
      metricCode: query.metricCode,
      from: filters.from ?? null,
      to: filters.to ?? null,
      results,
    };
  }
}

function bucketKey(date: Date, grain: 'DAILY' | 'WEEKLY' | 'MONTHLY') {
  const value = new Date(date);
  if (grain === 'DAILY') return value.toISOString().slice(0, 10);
  if (grain === 'MONTHLY') return value.toISOString().slice(0, 7);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value.toISOString().slice(0, 10);
}
