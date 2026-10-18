import { Inject, Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { renderReportPdf } from './pdf-renderer.js';
import type { DashboardQueryDto } from '../analytics/dto/dashboard-query.dto.js';

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
    const comparisonMetric =
      query.metricCode ??
      result.metricMetadata.find((metric) => result.kpis[metric.code] != null)
        ?.code ??
      'SM_CTR';
    const trendPoints = trend?.points.map((point) => ({
      bucket: point.bucket,
      value: point.kpis?.[comparisonMetric] ?? null,
    }));
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
        kpis: Object.entries(result.kpis)
          .filter(
            ([, value]) =>
              query.includeUnavailableMetrics === 'true' || value !== null,
          )
          .map(([code, value]) => ({
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
