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
  unit: 'COUNT' | 'MINUTES' | 'PERCENT';
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
  totals: Record<string, number | null>;
  campaigns: Array<{
    externalCampaignId: string;
    name: string;
    sentAt: string | null;
    observedAt: string;
    metricValues: Record<string, number | null>;
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
  AUDIENCE_SIZE: 'Audience size',
  AUDIENCE_CHANGE: 'Audience change',
  OPEN_RATE: 'Zoho-reported open rate',
  UNIQUE_CLICK_RATE: 'Zoho-reported unique click rate',
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
    maximumFractionDigits: unit === 'MINUTES' ? 1 : unit === 'PERCENT' ? 2 : 0,
  }).format(value);
  if (unit === 'MINUTES') return `${formatted} min`;
  if (unit === 'PERCENT') return `${formatted}%`;
  return formatted;
}

function formatDate(value: string | null) {
  if (!value) return 'Date not available';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    new Date(value),
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
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

function syncHealth(account: ConnectedAccount) {
  if (account.lastSyncErrorCode) {
    const error = friendlySyncError(account.lastSyncErrorCode);
    return {
      label: 'Update failed',
      detail: account.lastSyncedAt
        ? `Last successful update ${formatDateTime(account.lastSyncedAt)}. ${error}`
        : error,
      tone: 'error',
    };
  }
  if (!account.lastSyncedAt) {
    const pending =
      Date.now() - new Date(account.connectedAt).getTime() < 30 * 60_000;
    return {
      label: pending ? 'First sync starting' : 'No successful sync',
      detail: 'Automatic updates need a successful first sync.',
      tone: pending ? 'pending' : 'stale',
    };
  }
  const stale =
    Date.now() - new Date(account.lastSyncedAt).getTime() > 26 * 60 * 60_000;
  return {
    label: stale ? 'Update is stale' : 'Updates current',
    detail: `Last successful update ${formatDateTime(account.lastSyncedAt)}.`,
    tone: stale ? 'stale' : 'current',
  };
}

function formatProviderMetric(code: string) {
  return metricNames[code] ?? code.replaceAll('_', ' ').toLowerCase();
}

function csvCell(value: string | number) {
  const text = String(value);
  const protectedText =
    typeof value === 'string' && /^[\t\r\n ]*[=+\-@]/.test(text)
      ? `'${text}`
      : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
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
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonInitialized, setComparisonInitialized] = useState(false);
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
  const socialAccounts = accounts.filter(
    (account) => account.kind === 'SOCIAL',
  );
  const emailAccounts = accounts.filter((account) => account.kind === 'EMAIL');
  const comparisonAccounts = socialAccounts.filter((account) =>
    comparisonIds.includes(account.id),
  );
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
    if (comparisonInitialized || !socialAccounts.length) return;
    setComparisonIds(socialAccounts.slice(0, 2).map((account) => account.id));
    setComparisonInitialized(true);
  }, [comparisonInitialized, socialAccounts]);

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
  const comparisonQuery = useQuery({
    queryKey: [
      'account-comparison',
      currentUser.id,
      [...comparisonIds].sort(),
      from,
      to,
    ],
    enabled: comparisonAccounts.length >= 2 && Boolean(from && to),
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      return Promise.all(
        comparisonAccounts.map((account) =>
          apiRequest<AccountAnalytics>(
            `/accounts/${account.id}/analytics?${params}`,
          ),
        ),
      );
    },
  });
  const analytics = analyticsQuery.data;
  const email = emailQuery.data;
  const comparisonReports = comparisonQuery.data ?? [];
  const comparisonMetricCodes = [
    ...new Set(
      comparisonReports.flatMap((report) =>
        report.metrics.map((metric) => metric.code),
      ),
    ),
  ];
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

  function downloadComparisonCsv() {
    if (comparisonReports.length < 2) return;
    const headers = [
      'Type',
      'Measure',
      'Provider definitions',
      'Unit',
      'Data scope',
      'From',
      'To',
      ...comparisonReports.flatMap((report) => [
        report.account.displayName,
        `${report.account.displayName} change vs prior period`,
      ]),
    ];
    const metricRows = comparisonMetricCodes.map((code) => {
      const definitions = comparisonReports.map((report) => {
        const metric = report.metrics.find(
          (candidate) => candidate.code === code,
        );
        return `${providerNames[report.account.provider]}: ${metric?.label ?? 'not provided'}`;
      });
      const unit = comparisonReports
        .flatMap((report) => report.metrics)
        .find((metric) => metric.code === code)?.unit;
      return [
        'Metric',
        formatProviderMetric(code),
        definitions.join(' | '),
        unit ?? '',
        'Selected date range',
        from,
        to,
        ...comparisonReports.flatMap((report) => {
          const metric = report.metrics.find(
            (candidate) => candidate.code === code,
          );
          return [metric?.value ?? '', metric?.difference ?? ''];
        }),
      ];
    });
    const contentRows = comparisonReports.flatMap((report) =>
      report.topPosts
        .slice(0, 3)
        .map((post, index) => [
          'Top content',
          `${providerNames[report.account.provider]} rank ${index + 1}`,
          `${post.title || post.postType || 'Content item'} · ${formatProviderMetric(post.metricCode)}`,
          'COUNT',
          post.dataScope === 'LIFETIME' ? 'Lifetime' : 'Selected period',
          post.dataScope === 'LIFETIME' ? '' : from,
          post.dataScope === 'LIFETIME' ? '' : to,
          ...comparisonReports.flatMap((candidate) =>
            candidate.account.id === report.account.id
              ? [post.metricValue ?? '', '']
              : ['', ''],
          ),
        ]),
    );
    const csv = [headers, ...metricRows, ...contentRows]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `account-comparison-${from}-${to}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Your account comparison CSV is ready.');
  }

  function toggleComparison(accountId: string) {
    setComparisonIds((current) => {
      if (current.includes(accountId))
        return current.filter((id) => id !== accountId);
      if (current.length >= 4) return current;
      return [...current, accountId];
    });
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
      const result = await apiRequest<{
        providerAccessRevocation:
          | 'revoked'
          | 'already_inactive'
          | 'not_supported'
          | 'still_in_use'
          | 'failed';
      }>(`/accounts/${account.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({
        queryKey: ['connected-accounts', currentUser.id],
      });
      setSelectedId('');
      const revocationMessage = {
        revoked: 'Provider access was revoked.',
        already_inactive: 'The provider grant was already inactive.',
        not_supported:
          'This connection cannot be revoked with the stored credential; review the provider connected app settings if you want to remove access.',
        still_in_use:
          'Provider access remains active because another connected account uses the same grant.',
        failed:
          'Provider access could not be confirmed as revoked; review the provider connected app settings.',
      }[result.providerAccessRevocation];
      setMessage(
        `${account.displayName} was disconnected and its stored provider data was deleted. ${revocationMessage}`,
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
            {socialAccounts.map((account) => {
              const health = syncHealth(account);
              return (
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
                    <span
                      className={`connected-account-sync account-sync-status sync-${health.tone}`}
                      aria-label={`${health.label}. ${health.detail}`}
                    >
                      <strong>{health.label}</strong>
                      <small>{health.detail}</small>
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
              );
            })}
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

      {socialAccounts.length > 1 && (
        <section className="panel account-comparison-panel">
          <div className="panel-heading">
            <div>
              <h2>Compare connected accounts</h2>
              <p>
                Compare two to four accounts for {from} to {to}. Metrics stay
                with their provider definitions; values are never added across
                platforms.
              </p>
            </div>
            <div className="account-actions">
              <button
                className="secondary"
                type="button"
                disabled={
                  comparisonReports.length < 2 || comparisonQuery.isFetching
                }
                onClick={downloadComparisonCsv}
              >
                Download comparison CSV
              </button>
            </div>
          </div>
          <fieldset className="account-comparison-picker">
            <legend>Select accounts</legend>
            {socialAccounts.map((account) => {
              const checked = comparisonIds.includes(account.id);
              return (
                <label key={account.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!checked && comparisonIds.length >= 4}
                    onChange={() => toggleComparison(account.id)}
                  />
                  <span>
                    {account.displayName} · {providerNames[account.provider]}
                  </span>
                </label>
              );
            })}
          </fieldset>
          {comparisonAccounts.length < 2 ? (
            <p role="status">Select at least two accounts to compare.</p>
          ) : comparisonQuery.isLoading ? (
            <p role="status">Loading account comparison…</p>
          ) : comparisonQuery.error instanceof Error ? (
            <div className="notice error" role="alert">
              {comparisonQuery.error.message}
            </div>
          ) : comparisonReports.length ? (
            <>
              <div className="account-table-wrap">
                <table className="account-table account-comparison-table">
                  <caption>
                    {from} to {to}. Each value is reported for its connected
                    account; no cross-platform totals are calculated.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Measure</th>
                      {comparisonReports.map((report) => (
                        <th scope="col" key={report.account.id}>
                          {report.account.displayName}
                          <small>
                            {providerNames[report.account.provider]}
                          </small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonMetricCodes.map((code) => (
                      <tr key={code}>
                        <th scope="row">{formatProviderMetric(code)}</th>
                        {comparisonReports.map((report) => {
                          const metric = report.metrics.find(
                            (candidate) => candidate.code === code,
                          );
                          return (
                            <td className="numeric" key={report.account.id}>
                              <strong>
                                {formatValue(
                                  metric?.value ?? null,
                                  metric?.unit ?? 'COUNT',
                                )}
                              </strong>
                              <small>
                                {metric?.label ??
                                  'Not provided by this platform'}
                              </small>
                              {metric && metric.difference !== null && (
                                <small>
                                  {formatValue(metric.difference, metric.unit)}{' '}
                                  vs preceding period
                                  {metric.percentageChange === null
                                    ? ''
                                    : ` (${metric.percentageChange > 0 ? '+' : ''}${metric.percentageChange}%)`}
                                </small>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="account-comparison-content">
                {comparisonReports.map((report) => (
                  <article key={report.account.id}>
                    <h3>Top content · {report.account.displayName}</h3>
                    <p>
                      Ranked by{' '}
                      {formatProviderMetric(
                        report.topPosts[0]?.metricCode ?? 'top content',
                      )}
                      ; each count is labeled as lifetime or selected-period,
                      and uses this provider’s definition.
                    </p>
                    {report.topPosts.length ? (
                      <ol>
                        {report.topPosts.slice(0, 3).map((post) => (
                          <li key={post.externalPostId}>
                            <span>
                              {post.title || post.postType || 'Content item'}
                            </span>
                            <strong>
                              {formatValue(post.metricValue, 'COUNT')}
                            </strong>
                            <small>
                              {post.dataScope === 'LIFETIME'
                                ? 'Lifetime total'
                                : 'Selected-period total'}
                            </small>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>No top content is available for this date range.</p>
                    )}
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </section>
      )}

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
                          <strong>
                            {formatValue(
                              value,
                              code === 'OPEN_RATE' ||
                                code === 'UNIQUE_CLICK_RATE'
                                ? 'PERCENT'
                                : 'COUNT',
                            )}
                          </strong>
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
                              <th scope="col">Zoho-reported open rate</th>
                              <th scope="col">
                                Zoho-reported unique click rate
                              </th>
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
                                <td className="numeric">
                                  {formatValue(
                                    campaign.metricValues.OPEN_RATE ?? null,
                                    'PERCENT',
                                  )}
                                </td>
                                <td className="numeric">
                                  {formatValue(
                                    campaign.metricValues.UNIQUE_CLICK_RATE ??
                                      null,
                                    'PERCENT',
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
