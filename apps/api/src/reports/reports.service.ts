import { Inject, Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { renderReportPdf } from './pdf-renderer.js';
import type { DashboardQueryDto } from '../analytics/dto/dashboard-query.dto.js';

function reportValue(
  value: number | null,
  unit: string | undefined,
  currencyCode: string | null,
) {
  if (value === null) return 'Unavailable';
  if (unit === 'PERCENT') return `${value.toFixed(2)}%`;
  if (unit === 'CURRENCY')
    return `${currencyCode ?? 'Currency unset'} ${value.toFixed(2)}`;
  if (unit === 'POSITION') return value.toFixed(2);
  if (unit === 'COUNT') return new Intl.NumberFormat('en').format(value);
  return String(value);
}

@Injectable()
export class ReportsService {
  constructor(
    @Inject(AnalyticsService) private readonly analytics: AnalyticsService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async assemble(query: DashboardQueryDto) {
    const result = await this.analytics.dashboard(query);
    const [campaign, channel, platform, trend, comparison] = await Promise.all([
      query.campaignId
        ? this.prisma.campaign.findUnique({
            where: { id: query.campaignId },
            select: { name: true },
          })
        : null,
      query.channelId
        ? this.prisma.marketingChannel.findUnique({
            where: { id: query.channelId },
            select: { name: true },
          })
        : null,
      query.platformId
        ? this.prisma.platform.findUnique({
            where: { id: query.platformId },
            select: { name: true },
          })
        : null,
      query.from && query.to ? this.analytics.trends(query) : null,
      query.from && query.to ? this.analytics.comparison(query) : null,
    ]);
    const timeZone = result.reportingContext.timeZone ?? 'UTC';
    const generatedAt = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'long',
      timeZone,
    }).format(new Date());
    const labels = new Map(
      result.metricMetadata.map((metric) => [metric.code, metric]),
    );
    const comparisonMetric = query.metricCode ?? 'SM_CTR';
    const trendPoints = trend?.points.map((point) => ({
      bucket: point.bucket,
      value: point.kpis?.[comparisonMetric] ?? null,
    }));
    const lines = [
      'Digital Marketing Performance Report',
      `Generated: ${generatedAt} (${timeZone})`,
      `Period: ${query.from ?? 'all'} to ${query.to ?? 'all'}`,
      `Campaign: ${campaign?.name ?? (query.campaignId ? 'Unavailable' : 'All campaigns')}`,
      `Channel: ${channel?.name ?? (query.channelId ? 'Unavailable' : 'All channels')}`,
      `Platform: ${platform?.name ?? (query.platformId ? 'Unavailable' : 'All platforms')}`,
      `Metric filter: ${labels.get(comparisonMetric)?.label ?? 'All metrics'}`,
      `Target period: ${query.targetPeriod ?? 'off'}`,
      `Reporting currency: ${result.reportingContext.currencyCode ?? 'unset'}`,
      `Records included: ${result.recordCount}`,
      `Campaigns in scope: ${result.campaignCount}`,
      `Active channels in scope: ${result.channelCount}`,
      ...(comparison
        ? [
            `Comparison: ${comparison.currentPeriod.from.toISOString().slice(0, 10)} to ${comparison.currentPeriod.to.toISOString().slice(0, 10)} vs ${comparison.previousPeriod.from.toISOString().slice(0, 10)} to ${comparison.previousPeriod.to.toISOString().slice(0, 10)} (${comparison.isPartial ? 'partial calendar period' : comparison.type})`,
            `${labels.get(comparisonMetric)?.label ?? comparisonMetric}: current ${reportValue(comparison.current.kpis[comparisonMetric] ?? null, labels.get(comparisonMetric)?.unit, result.reportingContext.currencyCode)}; previous ${reportValue(comparison.previous.kpis[comparisonMetric] ?? null, labels.get(comparisonMetric)?.unit, result.reportingContext.currencyCode)}; difference ${reportValue(comparison.difference[comparisonMetric] ?? null, labels.get(comparisonMetric)?.unit, result.reportingContext.currencyCode)}; change ${comparison.percentageChange[comparisonMetric] == null ? 'Unavailable' : `${comparison.percentageChange[comparisonMetric]}%`}`,
          ]
        : ['Trend/comparison unavailable: choose both start and end dates.']),
      ...(trendPoints?.length
        ? [
            `Trend: ${trendPoints.length} ${trend?.grain?.toLowerCase() ?? 'period'} buckets; full series is listed in the report preview.`,
          ]
        : ['Trend: no dated series available.']),
      '',
      ...Object.entries(result.kpis).map(([code, value]) => {
        const metric = labels.get(code);
        const note = metric?.aggregationNote
          ? ` (${metric.aggregationNote})`
          : '';
        return `${metric?.label ?? code}: ${reportValue(value, metric?.unit, result.reportingContext.currencyCode)}${note}`;
      }),
      ...Object.entries(result.targetEvaluations ?? {}).map(
        ([code, evaluation]) => {
          const target = evaluation.target
            ? `${reportValue(evaluation.target.value, labels.get(code)?.unit, result.reportingContext.currencyCode)} (${evaluation.target.comparisonRule}, ${evaluation.target.scopeType} ${evaluation.target.periodType})`
            : 'No target';
          return `${labels.get(code)?.label ?? code} target: ${target}; status: ${evaluation.status ?? 'Status decision required'}`;
        },
      ),
    ];
    const report = {
      title: 'Digital Marketing Performance Report',
      generatedAt,
      timeZone,
      reportingTimeZoneConfigured: result.reportingContext.timeZone !== null,
      reportingCurrency: result.reportingContext.currencyCode,
      reportingCurrencyConfigured:
        result.reportingContext.currencyCode !== null,
      period: { from: query.from ?? null, to: query.to ?? null },
      filters: {
        campaign: campaign?.name ?? null,
        channel: channel?.name ?? null,
        platform: platform?.name ?? null,
        metric: query.metricCode
          ? (labels.get(query.metricCode)?.label ?? query.metricCode)
          : null,
        targetPeriod: query.targetPeriod ?? null,
      },
      summary: {
        recordCount: result.recordCount,
        campaignCount: result.campaignCount,
        channelCount: result.channelCount,
        kpis: Object.entries(result.kpis).map(([code, value]) => ({
          code,
          label: labels.get(code)?.label ?? code,
          unit: labels.get(code)?.unit ?? 'UNAVAILABLE',
          value,
          aggregationNote: labels.get(code)?.aggregationNote ?? null,
          target: result.targetEvaluations?.[code] ?? null,
        })),
      },
      comparison: comparison
        ? {
            currentPeriod: comparison.currentPeriod,
            previousPeriod: comparison.previousPeriod,
            isPartial: comparison.isPartial,
            metric: labels.get(comparisonMetric)?.label ?? comparisonMetric,
            unit: labels.get(comparisonMetric)?.unit ?? 'UNAVAILABLE',
            current: comparison.current.kpis[comparisonMetric] ?? null,
            previous: comparison.previous.kpis[comparisonMetric] ?? null,
            difference: comparison.difference[comparisonMetric] ?? null,
            percentageChange:
              comparison.percentageChange[comparisonMetric] ?? null,
          }
        : null,
      trend: trend
        ? {
            grain: trend.grain,
            metric: labels.get(comparisonMetric)?.label ?? comparisonMetric,
            unit: labels.get(comparisonMetric)?.unit ?? 'UNAVAILABLE',
            points: trendPoints ?? [],
          }
        : null,
      caveats: result.metricMetadata
        .map((metric) => metric.aggregationNote)
        .filter((note): note is string => Boolean(note)),
    };
    return { ...report, pdf: await renderReportPdf(report) };
  }

  async dashboardPdf(query: DashboardQueryDto) {
    const report = await this.assemble(query);
    return report.pdf;
  }

  async preview(query: DashboardQueryDto) {
    const { pdf: _pdf, ...preview } = await this.assemble(query);
    return preview;
  }
}
