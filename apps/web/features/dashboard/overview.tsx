'use client';

import { Kpi } from './kpi';
import { CampaignTable } from '../campaigns/campaign-table';
import { Empty } from '../../components/empty';
import { TrendLineChart } from '../analytics/charts';
import { formatKpi, formatNumber } from '../../lib/format';
import type {
  View,
  DashboardResult,
  Campaign,
  Channel,
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

function matchesTargetPeriod(
  period: string,
  from: string,
  to: string,
  campaignId: string,
) {
  if (period === 'CAMPAIGN') return Boolean(campaignId && !from && !to);
  if (!from || !to) return false;
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  if (period === 'DAILY') return from === to;
  if (period === 'WEEKLY') {
    const day = start.getUTCDay() || 7;
    const expectedEnd = new Date(start);
    expectedEnd.setUTCDate(expectedEnd.getUTCDate() + (7 - day));
    return day === 1 && expectedEnd.getTime() === end.getTime();
  }
  if (period === 'MONTHLY')
    return (
      start.getUTCDate() === 1 &&
      start.getUTCMonth() === end.getUTCMonth() &&
      start.getUTCFullYear() === end.getUTCFullYear() &&
      end.getUTCDate() ===
        new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
        ).getUTCDate()
    );
  if (period === 'QUARTERLY') {
    const quarter = Math.floor(start.getUTCMonth() / 3);
    return (
      start.getUTCDate() === 1 &&
      start.getUTCMonth() % 3 === 0 &&
      end.getUTCMonth() === quarter * 3 + 2 &&
      end.getUTCFullYear() === start.getUTCFullYear() &&
      end.getUTCDate() ===
        new Date(
          Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
        ).getUTCDate()
    );
  }
  return (
    period === 'YEARLY' &&
    start.getUTCMonth() === 0 &&
    start.getUTCDate() === 1 &&
    end.getUTCFullYear() === start.getUTCFullYear() &&
    end.getUTCMonth() === 11 &&
    end.getUTCDate() === 31
  );
}

export function Overview({
  result,
  campaigns,
  channels,
  filters,
  setFrom,
  setTo,
  setCampaignFilter,
  setChannelFilter,
  setPlatformFilter,
  setMetricFilter,
  setTargetPeriod,
  navigate,
  analytics,
  trends,
  trendsLoading,
  trendsError,
  retryTrends,
}: {
  result: DashboardResult | null;
  campaigns: Campaign[];
  channels: Channel[];
  filters: Filters;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  setCampaignFilter: (value: string) => void;
  setChannelFilter: (value: string) => void;
  setPlatformFilter: (value: string) => void;
  setMetricFilter: (value: string) => void;
  setTargetPeriod: (value: string) => void;
  navigate: (view: View) => void;
  analytics: boolean;
  trends: TrendResult | null;
  trendsLoading: boolean;
  trendsError: string;
  retryTrends: () => void;
}) {
  const selectedChannel = channels.find(
    (channel) => channel.id === filters.channelId,
  );
  const availablePlatforms = filters.channelId
    ? (selectedChannel?.platforms ?? [])
    : channels.flatMap((channel) => channel.platforms);
  const selectedMetric = result?.metricMetadata.find(
    (metric) => metric.code === filters.metricCode,
  );
  const selectableMetrics = (result?.metricMetadata ?? []).filter(
    (metric) =>
      !filters.channelId ||
      metric.applicableChannelIds?.includes(filters.channelId),
  );
  const chartMetric = filters.metricCode || 'SM_REACH';
  const chartMetadata = result?.metricMetadata.find(
    (metric) => metric.code === chartMetric,
  );
  const filtered = Boolean(
    filters.campaignId ||
    filters.channelId ||
    filters.platformId ||
    filters.metricCode,
  );
  const validTargetPeriods = new Set(
    ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CAMPAIGN'].filter(
      (period) =>
        matchesTargetPeriod(
          period,
          filters.from,
          filters.to,
          filters.campaignId,
        ),
    ),
  );
  const selectedMetricValue =
    selectedMetric?.unit === 'COUNT'
      ? formatNumber(result, selectedMetric.code)
      : formatKpi(result, selectedMetric?.code ?? '');

  return (
    <>
      <div className="filters" aria-label="Analytics filters">
        <div className="filter-field">
          <label htmlFor="from">From</label>
          <input
            id="from"
            className="filter"
            type="date"
            value={filters.from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="to">To</label>
          <input
            id="to"
            className="filter"
            type="date"
            value={filters.to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <div className="filter-field">
          <label htmlFor="campaign-filter">Campaign</label>
          <select
            id="campaign-filter"
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
        </div>
        <div className="filter-field">
          <label htmlFor="channel-filter">Channel</label>
          <select
            id="channel-filter"
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
        </div>
        <div className="filter-field">
          <label htmlFor="platform-filter">Platform</label>
          <select
            id="platform-filter"
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
        </div>
        <div className="filter-field">
          <label htmlFor="metric-filter">Metric</label>
          <select
            id="metric-filter"
            className="filter"
            value={filters.metricCode}
            onChange={(event) => setMetricFilter(event.target.value)}
          >
            <option value="">All metrics</option>
            {selectableMetrics.map((metric) => (
              <option key={metric.code} value={metric.code}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="target-period">Target period</label>
          <select
            id="target-period"
            className="filter"
            value={filters.targetPeriod}
            onChange={(event) => setTargetPeriod(event.target.value)}
          >
            <option value="">Targets off</option>
            <option value="DAILY" disabled={!validTargetPeriods.has('DAILY')}>
              Daily
            </option>
            <option value="WEEKLY" disabled={!validTargetPeriods.has('WEEKLY')}>
              Weekly
            </option>
            <option
              value="MONTHLY"
              disabled={!validTargetPeriods.has('MONTHLY')}
            >
              Monthly
            </option>
            <option
              value="QUARTERLY"
              disabled={!validTargetPeriods.has('QUARTERLY')}
            >
              Quarterly
            </option>
            <option value="YEARLY" disabled={!validTargetPeriods.has('YEARLY')}>
              Yearly
            </option>
            <option
              value="CAMPAIGN"
              disabled={!validTargetPeriods.has('CAMPAIGN')}
            >
              Campaign lifetime
            </option>
          </select>
        </div>
        <span className="filter muted">{result?.recordCount ?? 0} records</span>
      </div>
      <section className="kpi-grid" aria-label="KPI summary">
        {selectedMetric ? (
          <Kpi title={selectedMetric.label} value={selectedMetricValue} />
        ) : (
          <>
            <Kpi
              title="Campaigns in scope"
              value={String(result?.campaignCount ?? 0)}
            />
            <Kpi
              title="Active channels in scope"
              value={String(result?.channelCount ?? 0)}
            />
            <Kpi
              title="Aggregated daily reach"
              value={formatNumber(result, 'SM_REACH')}
            />
            <Kpi
              title="Engagement rate"
              value={formatKpi(result, 'SM_ENGAGEMENT_RATE')}
            />
            <Kpi
              title="Click-through rate"
              value={formatKpi(result, 'SM_CTR')}
            />
            <Kpi
              title="Email open rate"
              value={formatKpi(result, 'EMAIL_OPEN_RATE')}
            />
            <Kpi
              title="Emails sent"
              value={formatNumber(result, 'EMAIL_SENT')}
            />
            <Kpi
              title="Website conversions"
              value={formatNumber(result, 'WEB_CONVERSIONS')}
            />
            <Kpi
              title="Advertising conversions"
              value={formatNumber(result, 'ADS_CONVERSIONS')}
            />
            <Kpi title="Cost per click" value={formatKpi(result, 'ADS_CPC')} />
          </>
        )}
      </section>
      {filters.targetPeriod && result?.targetEvaluations && (
        <section className="panel" aria-labelledby="target-evaluations-title">
          <div className="panel-heading">
            <div>
              <h2 id="target-evaluations-title">Target evaluation</h2>
              <p>
                Targets apply only when their effective dates cover the full
                selected period.
              </p>
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">Actual</th>
                  <th scope="col">Target</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(result.targetEvaluations).map(
                  ([code, evaluation]) => {
                    const metadata = result.metricMetadata.find(
                      (metric) => metric.code === code,
                    );
                    const actual = evaluation.actual;
                    const actualText =
                      actual == null
                        ? 'Unavailable'
                        : metadata?.unit === 'COUNT'
                          ? new Intl.NumberFormat().format(actual)
                          : metadata?.unit === 'PERCENT'
                            ? `${actual.toFixed(2)}%`
                            : metadata?.unit === 'CURRENCY'
                              ? `${result.reportingContext.currencyCode ?? 'Currency unset'} ${actual.toFixed(2)}`
                              : String(actual);
                    return (
                      <tr key={code}>
                        <th scope="row">{metadata?.label ?? code}</th>
                        <td>{actualText}</td>
                        <td>{evaluation.target?.value ?? 'No target'}</td>
                        <td>{evaluation.target?.scopeType ?? '—'}</td>
                        <td>
                          {evaluation.statusDecisionRequired
                            ? 'Status rule requires clarification'
                            : (evaluation.status?.replaceAll('_', ' ') ?? '—')}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h2>{analytics ? 'Analytics trend' : 'Performance trend'}</h2>
            <p>
              {chartMetadata?.label ?? 'Aggregated daily reach'} by{' '}
              {trends?.grain?.toLowerCase() ?? 'selected period'} bucket.
            </p>
          </div>
          <button
            className="text-link button-link"
            onClick={() => navigate('analytics')}
          >
            Open analytics →
          </button>
        </div>
        {trendsLoading ? (
          <div className="empty-table" role="status">
            Loading trend data…
          </div>
        ) : trendsError ? (
          <div className="notice error" role="alert">
            {trendsError}{' '}
            <button className="text-link button-link" onClick={retryTrends}>
              Retry
            </button>
          </div>
        ) : !filters.from || !filters.to ? (
          <Empty
            title="Choose a date range"
            detail="Select start and end dates to load a trend."
          />
        ) : !trends?.points.length ? (
          <Empty
            title={filtered ? 'No matching trend data' : 'No performance data'}
            detail={
              filtered
                ? 'No records match the selected filters.'
                : 'No performance records exist for this period.'
            }
          />
        ) : (
          <>
            <TrendLineChart
              points={trends.points.map((point) => ({
                bucket: point.bucket,
                value: point.kpis[chartMetric] ?? null,
              }))}
              label={chartMetadata?.label ?? chartMetric}
              unit={chartMetadata?.unit ?? 'DECIMAL'}
              currencyCode={result?.reportingContext.currencyCode}
            />
            <div className="table-scroll">
              <table>
                <caption className="sr-only">
                  {chartMetadata?.label ?? 'Aggregated daily reach'} trend
                  values
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Period starting</th>
                    <th scope="col">
                      {chartMetadata?.label ?? 'Aggregated reach'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {trends.points.map((point) => {
                    const value = point.kpis[chartMetric];
                    const formatted =
                      value == null
                        ? 'Unavailable'
                        : chartMetadata?.unit === 'COUNT'
                          ? new Intl.NumberFormat().format(value)
                          : chartMetadata?.unit === 'PERCENT'
                            ? `${value.toFixed(2)}%`
                            : chartMetadata?.unit === 'CURRENCY'
                              ? `${result?.reportingContext.currencyCode ?? 'Currency unset'} ${value.toFixed(2)}`
                              : String(value);
                    return (
                      <tr key={point.bucket}>
                        <td>{point.bucket}</td>
                        <td>{formatted}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Active campaigns</h2>
            <p>Campaigns and their current delivery context.</p>
          </div>
          <button
            className="text-link button-link"
            onClick={() => navigate('campaigns')}
          >
            View all →
          </button>
        </div>
        {campaigns.length ? (
          <CampaignTable campaigns={campaigns.slice(0, 5)} />
        ) : (
          <Empty
            title="No active campaigns"
            detail="Create a campaign to start tracking performance."
          />
        )}
      </section>
    </>
  );
}
