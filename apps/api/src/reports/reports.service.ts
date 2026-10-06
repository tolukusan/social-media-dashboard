import { Inject, Injectable } from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { PrismaService } from '../database/prisma.service.js';
import type { DashboardQueryDto } from '../analytics/dto/dashboard-query.dto.js';

function pdfText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7e]/g, ' ');
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
      `Records included: ${result.recordCount}`,
      `Campaigns in scope: ${result.campaignCount}`,
      `Active channels in scope: ${result.channelCount}`,
      ...(comparison
        ? [
            `Comparison: ${comparison.currentPeriod.from.toISOString().slice(0, 10)} to ${comparison.currentPeriod.to.toISOString().slice(0, 10)} vs ${comparison.previousPeriod.from.toISOString().slice(0, 10)} to ${comparison.previousPeriod.to.toISOString().slice(0, 10)} (${comparison.isPartial ? 'partial calendar period' : comparison.type})`,
            `${labels.get(comparisonMetric)?.label ?? comparisonMetric} difference: ${comparison.difference[comparisonMetric] ?? 'Unavailable'}; change: ${comparison.percentageChange[comparisonMetric] == null ? 'Unavailable' : `${comparison.percentageChange[comparisonMetric]}%`}`,
          ]
        : ['Trend/comparison unavailable: choose both start and end dates.']),
      ...(trendPoints?.length
        ? [
            `Trend (${trend?.grain ?? 'period'}): ${trendPoints.map((point) => `${point.bucket}=${point.value ?? 'Unavailable'}`).join(', ')}`,
          ]
        : ['Trend: no dated series available.']),
      '',
      ...Object.entries(result.kpis).map(([code, value]) => {
        const metric = labels.get(code);
        const note = metric?.aggregationNote
          ? ` (${metric.aggregationNote})`
          : '';
        const rendered =
          value === null
            ? 'Unavailable'
            : `${value} ${metric?.unit ?? ''}`.trim();
        return `${metric?.label ?? code}: ${rendered}${note}`;
      }),
      ...Object.entries(result.targetEvaluations ?? {}).map(
        ([code, evaluation]) => {
          const target = evaluation.target
            ? `${evaluation.target.value} (${evaluation.target.comparisonRule}, ${evaluation.target.scopeType} ${evaluation.target.periodType})`
            : 'No target';
          return `${labels.get(code)?.label ?? code} target: ${target}; status: ${evaluation.status ?? 'Status decision required'}`;
        },
      ),
    ];
    return {
      title: 'Digital Marketing Performance Report',
      generatedAt,
      timeZone,
      reportingTimeZoneConfigured: result.reportingContext.timeZone !== null,
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
            points: trendPoints,
          }
        : null,
      caveats: result.metricMetadata
        .map((metric) => metric.aggregationNote)
        .filter((note): note is string => Boolean(note)),
      pdf: buildPdf(lines),
    };
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

function buildPdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 16 Tf',
    '50 760 Td',
    ...lines.flatMap((line, index) => [
      index ? '0 -22 Td' : '',
      `/F1 ${index === 0 ? 16 : 11} Tf`,
      `(${pdfText(line)}) Tj`,
    ]),
    'ET',
  ]
    .filter(Boolean)
    .join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content) + 1} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const startXref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n `)
    .join(
      '\n',
    )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;
  return Buffer.from(pdf, 'binary');
}
