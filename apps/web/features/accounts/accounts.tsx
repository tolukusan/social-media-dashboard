'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiRequest } from '../../lib/api-client';
import type { CurrentUser } from '../../lib/workspace-types';

type Provider =
  'INSTAGRAM' | 'FACEBOOK' | 'LINKEDIN' | 'YOUTUBE' | 'ZOHO_CAMPAIGNS';
type SetupProvider = {
  provider: Provider;
  ready: boolean;
  missing: string[];
  accountKind: 'SOCIAL' | 'EMAIL';
  scopes: string[];
  notes: string[];
};
type ConnectedAccount = {
  id: string;
  provider: Provider;
  kind: 'SOCIAL' | 'EMAIL';
  externalAccountId: string;
  displayName: string;
  handle: string | null;
  profileUrl: string | null;
  active: boolean;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncErrorCode: string | null;
  retention: { reportingDays: number | null; postSnapshotDays: number | null };
};
type Metric = {
  code: string;
  label: string;
  unit: 'COUNT' | 'MINUTES';
  mode: 'SUM' | 'SNAPSHOT' | 'DERIVED';
  value: number | null;
  previous: number | null;
  difference: number | null;
  percentageChange: number | null;
};
type TopPost = {
  externalPostId: string;
  title: string | null;
  postType: string | null;
  permalink: string | null;
  publishedAt: string | null;
  dataScope: string;
  metricCode: string;
  metricValue: number | null;
};
type AccountAnalytics = {
  account: ConnectedAccount;
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  metrics: Metric[];
  series: Array<{ date: string; values: Record<string, number | null> }>;
  topPosts: TopPost[];
  caveats: string[];
  dataAvailableThrough: string | null;
  generatedAt: string;
};
type EmailReport = {
  account: ConnectedAccount;
  period: { from: string; to: string };
  generatedAt: string;
  campaignCount: number;
  totals: Record<string, number>;
  campaigns: Array<{
    externalCampaignId: string;
    name: string;
    sentAt: string | null;
    observedAt: string;
    metricValues: Record<string, number>;
  }>;
  caveats: string[];
};
type AccountOptions = {
  providers: SetupProvider[];
  reportingTimezone: string;
  syncMode: string;
};

const providerNames: Record<Provider, string> = {
  INSTAGRAM: 'Instagram',
  FACEBOOK: 'Facebook Pages',
  LINKEDIN: 'LinkedIn Pages',
  YOUTUBE: 'YouTube',
  ZOHO_CAMPAIGNS: 'Zoho Campaigns',
};
const providerDescriptions: Record<Provider, string> = {
  INSTAGRAM:
    'Professional accounts: Business or Creator profiles linked to a Facebook Page.',
  FACEBOOK:
    'Facebook Pages you manage. Organic page and content performance is kept separate from ads.',
  LINKEDIN:
    'Organization pages where you have an administrator role and approved API access.',
  YOUTUBE: 'Channels managed by the Google account you authorize.',
  ZOHO_CAMPAIGNS:
    'Email campaign totals, shown separately from social account analytics.',
};
const defaultChartMetric: Record<Provider, string> = {
  INSTAGRAM: 'MEDIA_VIEWS',
  FACEBOOK: 'ORGANIC_MEDIA_VIEWS',
  LINKEDIN: 'ORGANIC_POST_IMPRESSIONS',
  YOUTUBE: 'VIEWS',
  ZOHO_CAMPAIGNS: 'SENT',
};
const metricNames: Record<string, string> = {
  MEDIA_VIEWS: 'Content views',
  ORGANIC_MEDIA_VIEWS: 'Organic content views',
  ORGANIC_POST_IMPRESSIONS: 'Organic post impressions',
  PAGE_VIEWS: 'Page views',
  VIEWS: 'Video views',
  AUDIENCE_CHANGE: 'Audience change',
};

function dayInTimezone(timeZone: string, offset = 0) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const date = new Date(`${today}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function formatValue(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return '—';
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: unit === 'MINUTES' ? 1 : 0,
  }).format(value);
  return unit === 'MINUTES' ? `${formatted} min` : formatted;
}

function formatDate(value: string | null) {
  if (!value) return 'Date not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function friendlySyncError(code: string | null) {
  if (!code) return null;
  const messages: Record<string, string> = {
    TOKEN_EXPIRED: 'Access expired. Reconnect this account to resume updates.',
    REAUTHENTICATION_REQUIRED: 'Reconnect this account to resume updates.',
    PROVIDER_ACCESS_DENIED:
      'The provider denied access. Check the account role and approved permissions.',
    PROVIDER_RATE_LIMITED:
      'The provider is temporarily limiting requests. Try again later.',
    TOKEN_ENCRYPTION_NOT_CONFIGURED:
      'Workspace setup is incomplete. Ask an administrator to finish secure provider setup.',
  };
  return (
    messages[code] ??
    'The last update did not complete. Try again or reconnect the account.'
  );
}

function formatProviderMetric(code: string) {
  return metricNames[code] ?? code.replaceAll('_', ' ').toLowerCase();
}

export function Accounts({ currentUser }: { currentUser: CurrentUser }) {
  const queryClient = useQueryClient();
  const canConnect = ['ADMIN', 'MARKETING_OFFICER'].includes(
    currentUser.role.code,
  );
  const isAdmin = currentUser.role.code === 'ADMIN';
  const [selectedId, setSelectedId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [chartMetric, setChartMetric] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<Provider | ''>('');

  const optionsQuery = useQuery({
    queryKey: ['account-options'],
    queryFn: () => apiRequest<AccountOptions>('/accounts/options'),
  });
  const accountsQuery = useQuery({
    queryKey: ['connected-accounts', currentUser.id],
    queryFn: () => apiRequest<ConnectedAccount[]>('/accounts'),
    refetchInterval: 30_000,
  });
  const accounts = accountsQuery.data ?? [];
  const selected =
    accounts.find((account) => account.id === selectedId) ?? null;
  const timezone = optionsQuery.data?.reportingTimezone ?? 'UTC';

  useEffect(() => {
    if (!from || !to) {
      const latest = dayInTimezone(timezone);
      setTo(latest);
      setFrom(dayInTimezone(timezone, -29));
    }
  }, [from, to, timezone]);

  useEffect(() => {
    if (selectedId && accounts.some((account) => account.id === selectedId))
      return;
    const preferred =
      preferredProvider &&
      accounts.find((account) => account.provider === preferredProvider);
    const next =
      preferred ??
      accounts.find((account) => account.kind === 'SOCIAL') ??
      accounts[0];
    if (next) setSelectedId(next.id);
  }, [accounts, selectedId, preferredProvider]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('accountConnection');
    const provider = params.get('provider')?.toUpperCase() as
      Provider | undefined;
    if (!status) return;
    if (provider && provider in providerNames) setPreferredProvider(provider);
    const providerName =
      provider && providerNames[provider]
        ? providerNames[provider]
        : 'provider';
    setMessage(
      status === 'connected'
        ? `${providerName} connected. The first account sync has started.`
        : status === 'no-accounts'
          ? `No eligible ${providerName} accounts were found for this login.`
          : status === 'cancelled'
            ? 'Account connection was cancelled.'
            : 'The provider could not complete account connection. Review its setup and try again.',
    );
    void queryClient.invalidateQueries({
      queryKey: ['connected-accounts', currentUser.id],
    });
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.hash}`,
    );
  }, [currentUser.id, queryClient]);

  const analyticsQuery = useQuery({
    queryKey: ['account-analytics', currentUser.id, selectedId, from, to],
    enabled: Boolean(selected?.kind === 'SOCIAL' && from && to),
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return apiRequest<AccountAnalytics>(
        `/accounts/${selectedId}/analytics?${params}`,
      );
    },
  });
  const emailQuery = useQuery({
    queryKey: ['account-email-report', currentUser.id, selectedId, from, to],
    enabled: Boolean(selected?.kind === 'EMAIL' && from && to),
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return apiRequest<EmailReport>(
        `/accounts/${selectedId}/email-report?${params}`,
      );
    },
  });
  const analytics = analyticsQuery.data;
  const email = emailQuery.data;
  const availableChartMetrics = useMemo(
    () => analytics?.metrics.filter((metric) => metric.mode === 'SUM') ?? [],
    [analytics?.metrics],
  );
  const chosenChartMetric =
    availableChartMetrics.find((metric) => metric.code === chartMetric) ??
    availableChartMetrics.find(
      (metric) =>
        metric.code === (selected ? defaultChartMetric[selected.provider] : ''),
    ) ??
    availableChartMetrics[0];
  const chartPoints = (analytics?.series ?? []).map((point) => ({
    date: point.date.slice(5),
    value: chosenChartMetric
      ? (point.values[chosenChartMetric.code] ?? null)
      : null,
  }));
  const growthPoints = (analytics?.series ?? []).map((point) => ({
    date: point.date.slice(5),
    value: point.values.AUDIENCE_CHANGE ?? null,
  }));

  async function connect(provider: Provider) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest<{ authorizationUrl: string }>(
        '/accounts/oauth/start',
        {
          method: 'POST',
          body: { provider },
        },
      );
      window.location.assign(result.authorizationUrl);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not begin provider connection.',
      );
      setBusy(false);
    }
  }

  async function syncNow() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest<{
        observations: number;
        posts: number;
        emailCampaigns: number;
      }>(`/accounts/${selected.id}/sync`, {
        method: 'POST',
        body: { from, to },
      });
      setMessage(
        `Updated this period: ${result.observations} daily metrics, ${result.posts} content items, and ${result.emailCampaigns} email campaigns.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['connected-accounts', currentUser.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['account-analytics', currentUser.id, selected.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['account-email-report', currentUser.id, selected.id],
        }),
      ]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not update the account.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disconnectAccount(account: ConnectedAccount) {
    if (
      !window.confirm(
        `Disconnect ${account.displayName} and delete its stored provider data?`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/accounts/${account.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({
        queryKey: ['connected-accounts', currentUser.id],
      });
      setSelectedId('');
      setMessage(
        `${account.displayName} was disconnected and its stored provider data was deleted.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not disconnect this account.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function downloadReport(emailReport = false) {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ from, to });
      const suffix = emailReport ? 'email-report.pdf' : 'report.pdf';
      const blob = await apiBlob(
        `/accounts/${selected.id}/${suffix}?${params}`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${selected.provider.toLowerCase()}-${emailReport ? 'email-' : ''}report-${to}.pdf`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage('Your PDF report is ready.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not prepare the report.',
      );
    } finally {
      setBusy(false);
    }
  }

  const setupProviders = optionsQuery.data?.providers ?? [];
  const socialAccounts = accounts.filter(
    (account) => account.kind === 'SOCIAL',
  );
  const emailAccounts = accounts.filter((account) => account.kind === 'EMAIL');
  const selectedError = selected
    ? friendlySyncError(selected.lastSyncErrorCode)
    : null;

  return (
    <div className="accounts-page">
      <section className="panel accounts-intro">
        <div>
          <p className="eyebrow">Independent of campaigns</p>
          <h2>See how each connected account is performing</h2>
          <p>
            Review audience growth, content activity, top posts, and changes
            against the previous period. Paid campaign results stay in
            Campaigns.
          </p>
        </div>
        <div className="account-period">
          <label>
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              min={from}
              max={dayInTimezone(timezone)}
              onChange={(event) => setTo(event.target.value)}
            />
          </label>
        </div>
      </section>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice account-success" role="status">
          {message}
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Connect accounts</h2>
            <p>
              Authorize a social profile or email service. Connection setup is
              separate from campaign creation.
            </p>
          </div>
          {!canConnect && (
            <span className="account-badge">
              Ask an Administrator or Marketing Officer to connect accounts
            </span>
          )}
        </div>
        <div className="provider-grid">
          {setupProviders.map((setup) => (
            <article className="provider-card" key={setup.provider}>
              <div className="provider-title-row">
                <span
                  className={`provider-icon provider-${setup.provider.toLowerCase()}`}
                  aria-hidden="true"
                >
                  {providerNames[setup.provider].slice(0, 1)}
                </span>
                <div>
                  <h3>{providerNames[setup.provider]}</h3>
                  <span>
                    {setup.accountKind === 'EMAIL'
                      ? 'Email reporting'
                      : 'Social analytics'}
                  </span>
                </div>
              </div>
              <p>{providerDescriptions[setup.provider]}</p>
              {setup.notes.map((note) => (
                <p className="provider-note" key={note}>
                  {note}
                </p>
              ))}
              <div className="provider-card-footer">
                <span
                  className={`status-pill ${setup.ready ? 'ready' : 'pending'}`}
                >
                  {setup.ready ? 'Ready to connect' : 'API setup needed'}
                </span>
                <button
                  className="primary"
                  type="button"
                  disabled={!setup.ready || !canConnect || busy}
                  onClick={() => void connect(setup.provider)}
                >
                  {busy ? 'Working…' : 'Connect'}
                </button>
              </div>
              {!setup.ready && (
                <details className="setup-details">
                  <summary>
                    What the workspace administrator needs to configure
                  </summary>
                  <span>
                    Required server settings: {setup.missing.join(', ')}.
                  </span>
                  <span>Requested permissions: {setup.scopes.join(', ')}.</span>
                </details>
              )}
            </article>
          ))}
          {!setupProviders.length && (
            <p role="status">Loading provider setup…</p>
          )}
        </div>
      </section>

      <section className="panel connected-accounts-panel">
        <div className="panel-heading">
          <div>
            <h2>Connected social accounts</h2>
            <p>Select an account to view its performance.</p>
          </div>
          <span className="account-badge">
            {socialAccounts.length} connected
          </span>
        </div>
        {accountsQuery.isLoading ? (
          <p role="status">Loading connected accounts…</p>
        ) : socialAccounts.length ? (
          <div
            className="connected-account-list"
            role="list"
            aria-label="Connected social accounts"
          >
            {socialAccounts.map((account) => (
              <div
                className={`connected-account ${selectedId === account.id ? 'selected' : ''}`}
                key={account.id}
                role="listitem"
              >
                <button
                  className="connected-account-select"
                  type="button"
                  onClick={() => setSelectedId(account.id)}
                  aria-pressed={selectedId === account.id}
                >
                  <span
                    className={`provider-icon provider-${account.provider.toLowerCase()}`}
                    aria-hidden="true"
                  >
                    {providerNames[account.provider].slice(0, 1)}
                  </span>
                  <span className="connected-account-name">
                    <strong>{account.displayName}</strong>
                    <small>
                      {providerNames[account.provider]}
                      {account.handle
                        ? ` · @${account.handle.replace(/^@/, '')}`
                        : ''}
                    </small>
                  </span>
                  <span className="connected-account-sync">
                    {account.lastSyncedAt
                      ? `Updated ${formatDate(account.lastSyncedAt)}`
                      : 'Not synced yet'}
                  </span>
                </button>
                {isAdmin && (
                  <button
                    className="text-button disconnect-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void disconnectAccount(account)}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="account-empty">
            <strong>No social accounts connected</strong>
            <span>
              Connect Instagram, Facebook, LinkedIn, or YouTube above. Account
              results are available before campaigns are created.
            </span>
          </div>
        )}
      </section>

      {selected?.kind === 'SOCIAL' && (
        <section className="panel account-dashboard">
          <div className="panel-heading account-dashboard-heading">
            <div>
              <p className="eyebrow">
                {providerNames[selected.provider]} account
              </p>
              <h2>{selected.displayName}</h2>
              <p>
                {from} to {to} · Compared with the preceding period
              </p>
            </div>
            <div className="account-actions">
              <button
                className="secondary"
                type="button"
                disabled={busy || analyticsQuery.isFetching}
                onClick={() => void syncNow()}
              >
                {busy ? 'Working…' : 'Sync this period'}
              </button>
              <button
                className="secondary"
                type="button"
                disabled={busy || analyticsQuery.isFetching}
                onClick={() => void downloadReport()}
              >
                {busy ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
          {selectedError && (
            <div className="notice error" role="alert">
              {selectedError}
            </div>
          )}
          {analyticsQuery.isLoading ? (
            <p role="status">Loading account analytics…</p>
          ) : analyticsQuery.error instanceof Error ? (
            <div className="account-empty">
              <strong>Analytics could not be loaded</strong>
              <span>{analyticsQuery.error.message}</span>
              <button
                className="secondary"
                type="button"
                onClick={() => void analyticsQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : analytics ? (
            <>
              <div className="account-metric-grid">
                {analytics.metrics.map((metric) => (
                  <article className="account-metric" key={metric.code}>
                    <span>{metric.label}</span>
                    <strong>{formatValue(metric.value, metric.unit)}</strong>
                    <small
                      className={
                        metric.difference === null
                          ? ''
                          : metric.difference >= 0
                            ? 'metric-positive'
                            : 'metric-negative'
                      }
                    >
                      {metric.difference === null
                        ? 'Comparison unavailable'
                        : `${metric.difference > 0 ? '+' : ''}${formatValue(metric.difference, metric.unit)} vs previous period${metric.percentageChange === null ? '' : ` (${metric.percentageChange > 0 ? '+' : ''}${metric.percentageChange}%)`}`}
                    </small>
                  </article>
                ))}
              </div>
              {analytics.dataAvailableThrough && (
                <p className="data-freshness">
                  Provider data last synced{' '}
                  {formatDate(analytics.dataAvailableThrough)}. Recent provider
                  data can arrive late.
                </p>
              )}

              <div className="account-chart-grid">
                <section className="account-chart-card">
                  <div className="account-chart-heading">
                    <div>
                      <h3>Daily content activity</h3>
                      <p>Daily totals use the provider’s metric definition.</p>
                    </div>
                    <label>
                      Show
                      <select
                        value={chosenChartMetric?.code ?? ''}
                        onChange={(event) => setChartMetric(event.target.value)}
                        disabled={!availableChartMetrics.length}
                      >
                        {availableChartMetrics.map((metric) => (
                          <option key={metric.code} value={metric.code}>
                            {metric.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {chosenChartMetric &&
                  chartPoints.some((point) => point.value !== null) ? (
                    <div
                      className="account-chart"
                      role="img"
                      aria-label={`${chosenChartMetric.label} by day. Exact values are listed in the chart tooltip.`}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartPoints} accessibilityLayer>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#eaecf0"
                          />
                          <XAxis
                            dataKey="date"
                            minTickGap={26}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            width={48}
                            tickFormatter={(value: number) =>
                              new Intl.NumberFormat(undefined, {
                                notation: 'compact',
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value) => [
                              formatValue(
                                typeof value === 'number' ? value : null,
                                chosenChartMetric.unit,
                              ),
                              chosenChartMetric.label,
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name={chosenChartMetric.label}
                            stroke="#2764e7"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="account-chart-empty">
                      No activity values are available for these dates. Sync
                      this period to request provider data.
                    </div>
                  )}
                </section>
                <section className="account-chart-card">
                  <div className="account-chart-heading">
                    <div>
                      <h3>Audience growth</h3>
                      <p>
                        Net audience change by day, where the provider makes it
                        available.
                      </p>
                    </div>
                  </div>
                  {growthPoints.some((point) => point.value !== null) ? (
                    <div
                      className="account-chart"
                      role="img"
                      aria-label="Daily audience change trend"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={growthPoints} accessibilityLayer>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#eaecf0"
                          />
                          <XAxis
                            dataKey="date"
                            minTickGap={26}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            width={48}
                            tickFormatter={(value: number) =>
                              new Intl.NumberFormat(undefined, {
                                notation: 'compact',
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            formatter={(value) => [
                              formatValue(
                                typeof value === 'number' ? value : null,
                                'COUNT',
                              ),
                              'Audience change',
                            ]}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name="Audience change"
                            stroke="#118a69"
                            strokeWidth={2.5}
                            dot={false}
                            connectNulls={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="account-chart-empty">
                      Audience growth will appear after the provider supplies
                      daily gains or this app collects more audience snapshots.
                    </div>
                  )}
                </section>
              </div>

              <section className="account-content-section">
                <div className="panel-heading">
                  <div>
                    <h3>Top content</h3>
                    <p>
                      Ranked by{' '}
                      {formatProviderMetric(
                        analytics.topPosts[0]?.metricCode ??
                          (selected.provider === 'LINKEDIN'
                            ? 'ORGANIC_POST_IMPRESSIONS'
                            : selected.provider === 'YOUTUBE'
                              ? 'VIEWS'
                              : 'VIEWS'),
                      )}
                      . Lifetime snapshots and selected-period metrics are
                      labelled.
                    </p>
                  </div>
                </div>
                {analytics.topPosts.length ? (
                  <div className="account-table-wrap">
                    <table className="account-table">
                      <thead>
                        <tr>
                          <th scope="col">Content</th>
                          <th scope="col">Published</th>
                          <th scope="col">Measurement</th>
                          <th scope="col" className="numeric">
                            Result
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topPosts.map((post) => (
                          <tr key={`${post.externalPostId}-${post.metricCode}`}>
                            <td>
                              {post.permalink ? (
                                <a
                                  href={post.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {post.title ||
                                    post.postType ||
                                    'View content'}
                                </a>
                              ) : (
                                post.title || post.postType || 'Content item'
                              )}
                            </td>
                            <td>{formatDate(post.publishedAt)}</td>
                            <td>
                              {formatProviderMetric(post.metricCode)} ·{' '}
                              {post.dataScope === 'LIFETIME'
                                ? 'lifetime'
                                : 'selected period'}
                            </td>
                            <td className="numeric">
                              {formatValue(post.metricValue, 'COUNT')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="account-chart-empty">
                    No top content is available for this period. Sync the exact
                    date range to refresh content results.
                  </div>
                )}
              </section>
              {analytics.caveats.length > 0 && (
                <details className="metric-notes">
                  <summary>Metric definitions and provider limits</summary>
                  <ul>
                    {analytics.caveats.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : null}
        </section>
      )}

      <section className="panel email-report-panel">
        <div className="panel-heading">
          <div>
            <h2>Email reports</h2>
            <p>
              Zoho campaign totals are kept separate from social account
              activity.
            </p>
          </div>
          {emailAccounts.length > 0 && (
            <span className="account-badge">
              {emailAccounts.length} connected
            </span>
          )}
        </div>
        {emailAccounts.length ? (
          <>
            <div className="email-account-select-row">
              <label>
                Zoho account
                <select
                  value={selected?.kind === 'EMAIL' ? selected.id : ''}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="" disabled>
                    Choose an email account
                  </option>
                  {emailAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.displayName}
                    </option>
                  ))}
                </select>
              </label>
              {selected?.kind === 'EMAIL' && (
                <div className="account-actions">
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void syncNow()}
                  >
                    {busy ? 'Working…' : 'Refresh email reports'}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void downloadReport(true)}
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </div>
            {selected?.kind === 'EMAIL' &&
              (emailQuery.isLoading ? (
                <p role="status">Loading email campaign reports…</p>
              ) : emailQuery.error instanceof Error ? (
                <div className="notice error" role="alert">
                  {emailQuery.error.message}
                </div>
              ) : (
                email && (
                  <>
                    <p className="email-report-context">
                      {email.campaignCount} campaigns sent between {from} and{' '}
                      {to}.
                    </p>
                    <div className="account-metric-grid email-metric-grid">
                      {Object.entries(email.totals).map(([code, value]) => (
                        <article className="account-metric" key={code}>
                          <span>{formatProviderMetric(code)}</span>
                          <strong>{formatValue(value, 'COUNT')}</strong>
                        </article>
                      ))}
                    </div>
                    {email.campaigns.length ? (
                      <div className="account-table-wrap">
                        <table className="account-table">
                          <thead>
                            <tr>
                              <th scope="col">Campaign</th>
                              <th scope="col">Sent date</th>
                              <th scope="col">Emails sent</th>
                              <th scope="col">Opens</th>
                              <th scope="col">Unique clicks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {email.campaigns.map((campaign) => (
                              <tr key={campaign.externalCampaignId}>
                                <td>{campaign.name}</td>
                                <td>{formatDate(campaign.sentAt)}</td>
                                <td className="numeric">
                                  {formatValue(
                                    campaign.metricValues.SENT ?? null,
                                    'COUNT',
                                  )}
                                </td>
                                <td className="numeric">
                                  {formatValue(
                                    campaign.metricValues.OPENS ?? null,
                                    'COUNT',
                                  )}
                                </td>
                                <td className="numeric">
                                  {formatValue(
                                    campaign.metricValues.UNIQUE_CLICKS ?? null,
                                    'COUNT',
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="account-chart-empty">
                        No sent campaigns were found in this date range.
                      </div>
                    )}
                    <details className="metric-notes">
                      <summary>How to read Zoho reports</summary>
                      <ul>
                        {email.caveats.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </details>
                  </>
                )
              ))}
          </>
        ) : (
          <div className="account-empty">
            <strong>No Zoho Campaigns account connected</strong>
            <span>
              Connect Zoho above to see email results in this separate report.
            </span>
          </div>
        )}
      </section>
    </div>
  );
}
