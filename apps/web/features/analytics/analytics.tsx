'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Empty } from '../../components/empty';
import { apiRequest } from '../../lib/api-client';
import type {
  Campaign,
  Channel,
  DashboardResult,
  TrendResult,
} from '../../lib/workspace-types';

type Filters = {
  from: string;
  to: string;
  campaignId: string;
  channelId: string;
  platformId: string;
  metricCode: string;
  targetPeriod: string;
};

type PeriodComparison = {
  type: string;
  isPartial: boolean;
  currentPeriod: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  current: DashboardResult;
  previous: DashboardResult;
  difference: Record<string, number | null>;
  percentageChange: Record<string, number | null>;
};

type DimensionComparison = {
  dimension: string;
  mode: string;
  metricCode: string;
  from: string | null;
  to: string | null;
  results: Array<{
    id: string;
    label: string;
    value: number | null;
    unit: string;
    durationDays?: number;
  }>;
};

export function Analytics({
  filters,
  campaigns,
  channels,
  result,
  trends,
  from,
  to,
  setFrom,
  setTo,
  setMetricFilter,
  setCampaignFilter,
  setChannelFilter,
  setPlatformFilter,
}: {
  filters: Filters;
  campaigns: Campaign[];
  channels: Channel[];
  result: DashboardResult | null;
  trends: TrendResult | null;
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  setMetricFilter: (value: string) => void;
  setCampaignFilter: (value: string) => void;
  setChannelFilter: (value: string) => void;
  setPlatformFilter: (value: string) => void;
}) {
  const [period, setPeriod] = useState<'CUSTOM' | 'MONTH' | 'QUARTER' | 'YEAR'>(
    'CUSTOM',
  );
  const [dimension, setDimension] = useState<'CAMPAIGN' | 'CHANNEL'>(
    'CAMPAIGN',
  );
  const [mode, setMode] = useState<'PERIOD' | 'LIFETIME'>('PERIOD');
  const [firstId, setFirstId] = useState('');
  const [secondId, setSecondId] = useState('');
  const metricCode = filters.metricCode || 'SM_CTR';
  const choices = dimension === 'CAMPAIGN' ? campaigns : channels;
  const availablePlatforms = filters.channelId
    ? (channels.find((channel) => channel.id === filters.channelId)
        ?.platforms ?? [])
    : channels.flatMap((channel) => channel.platforms);
  const first = firstId || choices[0]?.id || '';
  const second =
    secondId || choices.find((item) => item.id !== first)?.id || '';
  const metadata = result?.metricMetadata.find(
    (item) => item.code === metricCode,
  );
  const comparisonQuery = useQuery({
    queryKey: ['analytics-comparison', filters, period],
    enabled: Boolean(from && to && metadata),
    queryFn: () => {
      const params = new URLSearchParams(
        Object.entries({ ...filters, targetPeriod: '' }).filter(([, value]) =>
          Boolean(value),
        ),
      );
      params.set('comparisonPeriod', period);
      return apiRequest<PeriodComparison>(`/analytics/comparison?${params}`);
    },
  });
  const dimensionQuery = useQuery({
    queryKey: ['analytics-dimension', filters, dimension, first, second, mode],
    enabled: Boolean(
      first &&
      second &&
      first !== second &&
      metadata &&
      (mode === 'LIFETIME' || (from && to)),
    ),
    queryFn: () => {
      const params = new URLSearchParams(
        Object.entries({ ...filters, targetPeriod: '' }).filter(([, value]) =>
          Boolean(value),
        ),
      );
      params.set('dimension', dimension);
      params.set('dimensionIds', `${first},${second}`);
      params.set('comparisonMode', mode);
      params.set('metricCode', metricCode);
      return apiRequest<DimensionComparison>(
        `/analytics/dimension-comparison?${params}`,
      );
    },
  });
  const comparison = comparisonQuery.data;
  const dimensionResult = dimensionQuery.data;
  const formatValue = (value: number | null | undefined) => {
    if (value == null) return 'Unavailable';
    if (metadata?.unit === 'COUNT')
      return new Intl.NumberFormat().format(value);
    if (metadata?.unit === 'PERCENT') return `${value.toFixed(2)}%`;
    if (metadata?.unit === 'CURRENCY')
      return `${result?.reportingContext.currencyCode ?? 'Currency unset'} ${value.toFixed(2)}`;
    if (metadata?.unit === 'POSITION') return value.toFixed(2);
    return String(value);
  };
  const formatPercent = (value: number | null | undefined) =>
    value == null ? 'Unavailable' : `${value.toFixed(2)}%`;
  const periodError =
    comparisonQuery.error instanceof Error ? comparisonQuery.error.message : '';
  const dimensionError =
    dimensionQuery.error instanceof Error ? dimensionQuery.error.message : '';

  return (
    <div className="page-stack">
      <section className="panel page-panel">
        <div className="panel-heading">
          <div>
            <h2>Period comparison</h2>
            <p>
              Period boundaries and calculations come from the analytics
              service.
            </p>
          </div>
        </div>
        <div className="filters">
          <label htmlFor="analytics-from">From</label>
          <input
            id="analytics-from"
            className="filter"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <label htmlFor="analytics-to">To</label>
          <input
            id="analytics-to"
            className="filter"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          <label htmlFor="analytics-campaign-filter">Campaign</label>
          <select
            id="analytics-campaign-filter"
            className="filter"
            value={filters.campaignId}
            onChange={(event) => setCampaignFilter(event.target.value)}
          >
            <option value="">All campaigns</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          <label htmlFor="analytics-channel-filter">Channel</label>
          <select
            id="analytics-channel-filter"
            className="filter"
            value={filters.channelId}
            onChange={(event) => {
              setChannelFilter(event.target.value);
              setPlatformFilter('');
            }}
          >
            <option value="">All channels</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.name}
              </option>
            ))}
          </select>
          <label htmlFor="analytics-platform-filter">Platform</label>
          <select
            id="analytics-platform-filter"
            className="filter"
            value={filters.platformId}
            onChange={(event) => setPlatformFilter(event.target.value)}
          >
            <option value="">All platforms</option>
            {availablePlatforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
          <label htmlFor="comparison-period">Compare</label>
          <select
            id="comparison-period"
            className="filter"
            value={period}
            onChange={(event) => setPeriod(event.target.value as typeof period)}
          >
            <option value="CUSTOM">Preceding equal-length period</option>
            <option value="MONTH">Calendar month</option>
            <option value="QUARTER">Calendar quarter</option>
            <option value="YEAR">Calendar year</option>
          </select>
          <label htmlFor="analytics-metric">Metric</label>
          <select
            id="analytics-metric"
            className="filter"
            value={filters.metricCode}
            onChange={(event) => setMetricFilter(event.target.value)}
          >
            <option value="">Click-through rate</option>
            {(result?.metricMetadata ?? []).map((metric) => (
              <option
                key={metric.code}
                value={metric.code}
                disabled={Boolean(
                  filters.channelId &&
                  !metric.applicableChannelIds?.includes(filters.channelId),
                )}
              >
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        {!from || !to ? (
          <Empty
            title="Choose a date range"
            detail="Select dates to compare periods."
          />
        ) : comparisonQuery.isFetching ? (
          <div role="status">Loading comparison…</div>
        ) : periodError ? (
          <div className="notice error" role="alert">
            {periodError}
          </div>
        ) : comparison ? (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                {metadata?.label ?? metricCode} period comparison
              </caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Dates</th>
                  <th scope="col">Actual</th>
                  <th scope="col">Difference</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    Current{comparison.isPartial ? ' (partial)' : ''}
                  </th>
                  <td>
                    {comparison.currentPeriod.from.slice(0, 10)} –{' '}
                    {comparison.currentPeriod.to.slice(0, 10)}
                  </td>
                  <td>{formatValue(comparison.current.kpis[metricCode])}</td>
                  <td>{formatValue(comparison.difference[metricCode])}</td>
                  <td>
                    {formatPercent(comparison.percentageChange[metricCode])}
                  </td>
                </tr>
                <tr>
                  <th scope="row">Previous</th>
                  <td>
                    {comparison.previousPeriod.from.slice(0, 10)} –{' '}
                    {comparison.previousPeriod.to.slice(0, 10)}
                  </td>
                  <td>{formatValue(comparison.previous.kpis[metricCode])}</td>
                  <td>—</td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <section className="panel page-panel">
        <div className="panel-heading">
          <div>
            <h2>Campaign or channel comparison</h2>
            <p>
              Compare the same approved metric across the selected contexts.
            </p>
          </div>
        </div>
        <div className="filters">
          <label htmlFor="dimension-kind">Compare</label>
          <select
            id="dimension-kind"
            className="filter"
            value={dimension}
            onChange={(event) => {
              const next = event.target.value as typeof dimension;
              setDimension(next);
              setFirstId('');
              setSecondId('');
              if (next === 'CHANNEL') setMode('PERIOD');
            }}
          >
            <option value="CAMPAIGN">Campaigns</option>
            <option value="CHANNEL">Channels</option>
          </select>
          <label htmlFor="dimension-mode">Period</label>
          <select
            id="dimension-mode"
            className="filter"
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="PERIOD">Selected dates</option>
            {dimension === 'CAMPAIGN' && (
              <option value="LIFETIME">Campaign lifetime</option>
            )}
          </select>
          <label htmlFor="dimension-first">
            First {dimension.toLowerCase()}
          </label>
          <select
            id="dimension-first"
            className="filter"
            value={first}
            onChange={(event) => setFirstId(event.target.value)}
          >
            {choices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label htmlFor="dimension-second">
            Second {dimension.toLowerCase()}
          </label>
          <select
            id="dimension-second"
            className="filter"
            value={second}
            onChange={(event) => setSecondId(event.target.value)}
          >
            {choices
              .filter((item) => item.id !== first)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </div>
        {!second || first === second ? (
          <Empty
            title={`Choose two ${dimension.toLowerCase()}s`}
            detail="At least two active items are needed for comparison."
          />
        ) : mode === 'PERIOD' && (!from || !to) ? (
          <Empty
            title="Choose a date range"
            detail="Select dates for a period comparison."
          />
        ) : dimensionQuery.isFetching ? (
          <div role="status">Loading comparison…</div>
        ) : dimensionError ? (
          <div className="notice error" role="alert">
            {dimensionError}
          </div>
        ) : dimensionResult ? (
          <div className="table-scroll">
            <table>
              <caption className="sr-only">
                {metadata?.label ?? metricCode} by {dimension.toLowerCase()}
              </caption>
              <thead>
                <tr>
                  <th scope="col">{dimension}</th>
                  <th scope="col">Value</th>
                  {mode === 'LIFETIME' && (
                    <th scope="col">Campaign duration</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {dimensionResult.results.map((item) => (
                  <tr key={item.id}>
                    <th scope="row">{item.label}</th>
                    <td>{formatValue(item.value)}</td>
                    {mode === 'LIFETIME' && <td>{item.durationDays} days</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <section className="panel page-panel">
        <h2>Trend values</h2>
        {trends?.points.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Bucket</th>
                  <th scope="col">{metadata?.label ?? 'Click-through rate'}</th>
                </tr>
              </thead>
              <tbody>
                {trends.points.map((point) => (
                  <tr key={point.bucket}>
                    <th scope="row">{point.bucket}</th>
                    <td>{formatValue(point.kpis[metricCode])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="No trend points"
            detail="Choose dates and a metric with data to see trends."
          />
        )}
      </section>
    </div>
  );
}
