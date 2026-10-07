'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiBlob, apiRequest, queryKeys } from '../../lib/api-client';

type ReportFilters = {
  from: string;
  to: string;
  campaignId: string;
  channelId: string;
  platformId: string;
  metricCode: string;
  targetPeriod: string;
};

type ReportPreview = {
  title: string;
  generatedAt: string;
  timeZone: string;
  reportingTimeZoneConfigured: boolean;
  reportingCurrency: string | null;
  reportingCurrencyConfigured: boolean;
  period: { from: string | null; to: string | null };
  filters: {
    campaign: string | null;
    channel: string | null;
    platform: string | null;
    metric: string | null;
    targetPeriod: string | null;
  };
  summary: {
    recordCount: number;
    campaignCount: number;
    channelCount: number;
    kpis: Array<{
      code: string;
      label: string;
      unit: string;
      value: number | null;
      aggregationNote: string | null;
      target: {
        status: string | null;
        target: { value: number; comparisonRule: string } | null;
        statusDecisionRequired?: boolean;
      } | null;
    }>;
  };
  comparison: {
    currentPeriod: { from: string; to: string };
    previousPeriod: { from: string; to: string };
    isPartial: boolean;
    metric: string;
    unit: string;
    current: number | null;
    previous: number | null;
    difference: number | null;
    percentageChange: number | null;
  } | null;
  trend: {
    grain: string;
    metric: string;
    unit: string;
    points: Array<{ bucket: string; value: number | null }>;
  } | null;
  caveats: string[];
};

function valueLabel(
  value: number | null,
  unit: string,
  currencyCode: string | null,
) {
  if (value === null) return 'Unavailable';
  if (unit === 'PERCENT') return `${value.toFixed(2)}%`;
  if (unit === 'CURRENCY')
    return currencyCode
      ? `${currencyCode} ${value.toFixed(2)}`
      : `Currency unset ${value.toFixed(2)}`;
  if (unit === 'POSITION') return value.toFixed(2);
  return new Intl.NumberFormat().format(value);
}

export function Reports({ filters }: { filters: ReportFilters }) {
  const { from, to } = filters;
  const [downloadError, setDownloadError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState('CUSTOM');
  const query = new URLSearchParams(
    Object.entries({ ...filters, comparisonPeriod }).filter(([, value]) =>
      Boolean(value),
    ),
  );
  const previewQuery = useQuery({
    queryKey: [...queryKeys.report(filters), comparisonPeriod],
    queryFn: () => apiRequest<ReportPreview>(`/reports/preview?${query}`),
  });
  const preview = previewQuery.data;
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await apiBlob(`/reports/dashboard.pdf?${query}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `marketing-performance-report_${from || 'all'}_to_${to || 'all'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setDownloadError(
        cause instanceof Error
          ? cause.message
          : 'Report could not be downloaded.',
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <div>
          <h2>Reports</h2>
          <p>Preview and download use the same filtered analytics service.</p>
        </div>
        <button
          className="primary download"
          type="button"
          disabled={downloading}
          onClick={() => void download()}
        >
          {downloading ? 'Preparing PDF…' : 'Download PDF'}
        </button>
      </div>
      {downloadError && (
        <div className="notice error" role="alert">
          {downloadError}
        </div>
      )}
      <div className="report-preview">
        <strong>
          {preview?.title ?? 'Digital Marketing Performance Report'}
        </strong>
        {previewQuery.isPending && (
          <span role="status">Loading report preview…</span>
        )}
        {previewQuery.error && (
          <div className="notice error" role="alert">
            Could not assemble the report preview.
            <button
              type="button"
              className="secondary"
              onClick={() => void previewQuery.refetch()}
            >
              Retry
            </button>
          </div>
        )}
        {preview && (
          <>
            <span>
              Generated: {preview.generatedAt} ({preview.timeZone})
            </span>
            {!preview.reportingTimeZoneConfigured && (
              <span>
                Reporting timezone is unset; timestamps are shown in UTC.
              </span>
            )}
            {!preview.reportingCurrencyConfigured && (
              <span>
                Reporting currency is unset; currency values are not labelled
                with a currency code.
              </span>
            )}
            <span>
              Period: {(preview.period.from ?? from) || 'All dates'} →{' '}
              {(preview.period.to ?? to) || 'All dates'}
            </span>
            <span>
              Filters: Campaign{' '}
              {preview.filters.campaign ??
                (filters.campaignId ? 'Unavailable' : 'All campaigns')}{' '}
              · Channel{' '}
              {preview.filters.channel ??
                (filters.channelId ? 'Unavailable' : 'All channels')}{' '}
              · Platform{' '}
              {preview.filters.platform ??
                (filters.platformId ? 'Unavailable' : 'All platforms')}{' '}
              · Metric {preview.filters.metric ?? 'All metrics'}
            </span>
            <span>
              Records: {preview.summary.recordCount} · Campaigns:{' '}
              {preview.summary.campaignCount} · Channels:{' '}
              {preview.summary.channelCount}
            </span>
            {preview.summary.recordCount === 0 && (
              <div className="notice" role="status">
                No records match these filters. KPI values are unavailable, not
                zero.
              </div>
            )}
            <label htmlFor="report-comparison-period">Comparison period</label>
            <select
              id="report-comparison-period"
              className="filter"
              value={comparisonPeriod}
              onChange={(event) => setComparisonPeriod(event.target.value)}
            >
              <option value="CUSTOM">Preceding equal-length period</option>
              <option value="MONTH">Calendar month</option>
              <option value="QUARTER">Calendar quarter</option>
              <option value="YEAR">Calendar year</option>
            </select>
            {preview.summary.kpis.length > 0 ? (
              <div className="table-scroll">
                <table>
                  <caption>Report KPI summary</caption>
                  <thead>
                    <tr>
                      <th scope="col">KPI</th>
                      <th scope="col">Actual</th>
                      <th scope="col">Target</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.summary.kpis.map((item) => (
                      <tr key={item.code}>
                        <th scope="row">{item.label}</th>
                        <td>{valueLabel(item.value, item.unit, preview.reportingCurrency)}</td>
                        <td>
                          {item.target?.target
                            ? valueLabel(
                                item.target.target.value,
                                item.unit,
                                preview.reportingCurrency,
                              )
                            : 'No target'}
                        </td>
                        <td>
                          {item.target?.status ??
                            (item.target?.statusDecisionRequired
                              ? 'Status decision required'
                              : 'Not evaluated')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {preview.comparison && (
              <span>
                {preview.comparison.metric} comparison:{' '}
                {preview.comparison.currentPeriod.from.slice(0, 10)} to{' '}
                {preview.comparison.currentPeriod.to.slice(0, 10)} vs{' '}
                {preview.comparison.previousPeriod.from.slice(0, 10)} to{' '}
                {preview.comparison.previousPeriod.to.slice(0, 10)} · Current{' '}
                {valueLabel(
                  preview.comparison.current,
                  preview.comparison.unit,
                  preview.reportingCurrency,
                )}
                {' · Previous '}
                {valueLabel(
                  preview.comparison.previous,
                  preview.comparison.unit,
                  preview.reportingCurrency,
                )}
                {' · Difference '}
                {valueLabel(
                  preview.comparison.difference,
                  preview.comparison.unit,
                  preview.reportingCurrency,
                )}
                {' · Change '}
                {preview.comparison.percentageChange === null
                  ? 'Unavailable'
                  : `${preview.comparison.percentageChange.toFixed(2)}%`}
                {preview.comparison.isPartial
                  ? ' · Partial calendar period'
                  : ''}
              </span>
            )}
            {preview.trend && (
              <div className="table-scroll">
                <table>
                  <caption>
                    {preview.trend.metric} trend by{' '}
                    {preview.trend.grain.toLowerCase()}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.trend.points.map((point) => (
                      <tr key={point.bucket}>
                        <th scope="row">{point.bucket}</th>
                        <td>
                          {valueLabel(
                            point.value,
                            preview.trend!.unit,
                            preview.reportingCurrency,
                          )}
                        </td>
                      </tr>
                    ))}
                    {!preview.trend.points.length && (
                      <tr>
                        <td colSpan={2}>No trend buckets in this period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {preview.caveats.map((note) => (
              <span key={note}>Data note: {note}</span>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
