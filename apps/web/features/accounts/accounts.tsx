'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiRequest } from '../../lib/api-client';
import type { CurrentUser, View } from '../../lib/workspace-types';
import {
  DateRangeControls,
  InfoBanner,
  MetricTile,
  PageHeading,
  ProviderMark,
  StatusPill,
  type ProviderCode,
} from '../../components/account-ui';

type Provider = ProviderCode;
type AccountView = Extract<
  View,
  'accounts' | 'account-insights' | 'account-comparison' | 'email-reports'
>;
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
const EMPTY_ACCOUNTS: ConnectedAccount[] = [];
type Metric = {
  code: string;
  label: string;
  unit: 'COUNT' | 'MINUTES' | 'PERCENT';
  mode: 'SUM' | 'SNAPSHOT' | 'DERIVED';
  value: number | null;
  previous: number | null;
  difference: number | null;
  percentageChange: number | null;
  coverage: {
    status: 'COMPLETE' | 'PARTIAL' | 'NONE';
    requestedDays: number | null;
    observedDays: number | null;
    firstObservedDate: string | null;
    lastObservedDate: string | null;
    snapshotDate?: string | null;
  };
  previousCoverage?: { status: 'COMPLETE' | 'PARTIAL' | 'NONE' };
};
type SyncJob = {
  id: string;
  status:
    'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED';
  requestedPeriod: { from: string; to: string };
  fetchablePeriod: { from: string; to: string } | null;
  completedChunks: number;
  totalChunks: number;
  successfulChunks: number;
  failedChunks: number;
  errors: Array<{ code: string; from: string; to: string; attempts: number }>;
  finalErrorCode: string | null;
  updatedAt: string;
  completedAt: string | null;
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
  coverage: {
    requestedDays: number;
    latestSuccessfulHistoryFetchAt: string | null;
    postSnapshotRetentionDays: number | null;
  };
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
type SyncTone = 'current' | 'error' | 'pending' | 'stale';
type SyncHealth = { label: string; detail: string; tone: SyncTone };

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

function syncHealth(account: ConnectedAccount): SyncHealth {
  if (!account.active)
    return {
      label: 'Disconnected',
      detail: 'Syncing has stopped. Historical analytics are retained.',
      tone: 'stale',
    };
  if (account.lastSyncErrorCode) {
    const error =
      friendlySyncError(account.lastSyncErrorCode) ??
      'The last update did not complete. Try again or reconnect the account.';
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

export function Accounts({
  currentUser,
  view,
  navigate,
}: {
  currentUser: CurrentUser;
  view: AccountView;
  navigate: (view: View) => void;
}) {
  const queryClient = useQueryClient();
  const canConnect = ['ADMIN', 'MARKETING_OFFICER'].includes(
    currentUser.role.code,
  );
  const isAdmin = currentUser.role.code === 'ADMIN';
  const [selectedId, setSelectedId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [periodPreset, setPeriodPreset] = useState<
    '30' | '90' | '365' | 'CUSTOM'
  >('30');
  const [syncJobId, setSyncJobId] = useState('');
  const [syncJobAccountId, setSyncJobAccountId] = useState('');
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonInitialized, setComparisonInitialized] = useState(false);
  const [chartMetric, setChartMetric] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [preferredProvider, setPreferredProvider] = useState<Provider | ''>('');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [providersOpen, setProvidersOpen] = useState(false);
  const providerPanelInitialized = useRef(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const optionsQuery = useQuery({
    queryKey: ['account-options'],
    queryFn: () => apiRequest<AccountOptions>('/accounts/options'),
  });
  const accountsQuery = useQuery({
    queryKey: ['connected-accounts', currentUser.id],
    queryFn: () => apiRequest<ConnectedAccount[]>('/accounts'),
    refetchInterval: 30_000,
  });
  const accounts = accountsQuery.data ?? EMPTY_ACCOUNTS;
  const socialAccounts = useMemo(
    () => accounts.filter((account) => account.kind === 'SOCIAL'),
    [accounts],
  );
  const emailAccounts = useMemo(
    () => accounts.filter((account) => account.kind === 'EMAIL'),
    [accounts],
  );
  const comparisonAccounts = useMemo(
    () =>
      socialAccounts.filter((account) => comparisonIds.includes(account.id)),
    [comparisonIds, socialAccounts],
  );
  const selected = useMemo(
    () => accounts.find((account) => account.id === selectedId) ?? null,
    [accounts, selectedId],
  );
  const timezone = optionsQuery.data?.reportingTimezone ?? 'Africa/Lagos';
  const isMetaAccount =
    selected?.provider === 'INSTAGRAM' || selected?.provider === 'FACEBOOK';
  const today = dayInTimezone(timezone);

  const accountSummaryQueries = useQueries({
    queries: socialAccounts.map((account) => ({
      queryKey: ['account-analytics', currentUser.id, account.id, from, to],
      enabled: view === 'accounts' && Boolean(from && to),
      staleTime: 60_000,
      queryFn: () => {
        const params = new URLSearchParams({ from, to });
        return apiRequest<AccountAnalytics>(
          `/accounts/${account.id}/analytics?${params}`,
        );
      },
    })),
  });

  useEffect(() => {
    if (view === 'account-insights') {
      if (periodPreset === 'CUSTOM') return;
      const days = Number(periodPreset);
      setTo(today);
      setFrom(dayInTimezone(timezone, -(days - 1)));
      return;
    }
    if (!from || !to) {
      setTo(today);
      setFrom(dayInTimezone(timezone, -29));
    }
  }, [from, periodPreset, timezone, today, to, view]);

  useEffect(() => {
    setSyncJobId('');
    setSyncJobAccountId('');
  }, [selectedId]);

  useEffect(() => {
    if (
      selected &&
      selected.provider !== 'INSTAGRAM' &&
      selected.provider !== 'FACEBOOK' &&
      periodPreset === '365'
    ) {
      setPeriod(90);
    }
  }, [periodPreset, selected]);

  useEffect(() => {
    setMessage('');
  }, [view]);

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
    if (accountsQuery.isLoading || providerPanelInitialized.current) return;
    providerPanelInitialized.current = true;
    setProvidersOpen(accounts.length === 0);
  }, [accounts.length, accountsQuery.isLoading]);

  useEffect(() => {
    if (view === 'email-reports' && selected?.kind !== 'EMAIL') {
      const nextEmail = emailAccounts[0];
      if (nextEmail) setSelectedId(nextEmail.id);
    } else if (
      view === 'account-insights' &&
      selected?.kind !== 'SOCIAL' &&
      socialAccounts.length
    ) {
      setSelectedId(socialAccounts[0].id);
    }
  }, [emailAccounts, selected, socialAccounts, view]);

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
    enabled: Boolean(
      view === 'account-insights' && selected?.kind === 'SOCIAL' && from && to,
    ),
    queryFn: () => {
      const params = new URLSearchParams({ from, to });
      return apiRequest<AccountAnalytics>(
        `/accounts/${selectedId}/analytics?${params}`,
      );
    },
  });
  const activeSyncJobQuery = useQuery({
    queryKey: ['account-sync-job-active', currentUser.id, selectedId],
    enabled: Boolean(
      view === 'account-insights' && isMetaAccount && selected?.active,
    ),
    queryFn: () =>
      apiRequest<SyncJob | null>(`/accounts/${selectedId}/sync-jobs/active`),
    refetchInterval: () =>
      typeof document !== 'undefined' && document.visibilityState === 'visible'
        ? 3000
        : false,
  });
  const activeSyncJob = activeSyncJobQuery.data;
  useEffect(() => {
    if (!activeSyncJob) return;
    setSyncJobId(activeSyncJob.id);
    setSyncJobAccountId(selectedId);
  }, [activeSyncJob, selectedId]);
  const syncJobQuery = useQuery({
    queryKey: ['account-sync-job', currentUser.id, syncJobAccountId, syncJobId],
    enabled: Boolean(
      syncJobId &&
      syncJobAccountId === selectedId &&
      selected?.provider &&
      isMetaAccount,
    ),
    queryFn: () =>
      apiRequest<SyncJob>(
        `/accounts/${syncJobAccountId}/sync-jobs/${syncJobId}`,
      ),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'QUEUED' || status === 'RUNNING' ? 3000 : false;
    },
  });
  const syncJob = syncJobQuery.data;
  const syncProgressRefresh = useRef({
    jobId: '',
    successfulChunks: -1,
    lastAnalyticsRefreshAt: 0,
    finalizedJobId: '',
  });
  useEffect(() => {
    if (!syncJob || syncJobAccountId !== selectedId) return;
    if (syncProgressRefresh.current.jobId !== syncJob.id) {
      syncProgressRefresh.current = {
        jobId: syncJob.id,
        successfulChunks: -1,
        lastAnalyticsRefreshAt: 0,
        finalizedJobId: '',
      };
    }
    const progress = syncProgressRefresh.current;
    if (syncJob.successfulChunks !== progress.successfulChunks) {
      progress.successfulChunks = syncJob.successfulChunks;
      const now = Date.now();
      if (now - progress.lastAnalyticsRefreshAt >= 10_000) {
        progress.lastAnalyticsRefreshAt = now;
        void queryClient.invalidateQueries({
          queryKey: ['account-analytics', currentUser.id, selectedId],
        });
      }
    }
    const terminal = ['SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(
      syncJob.status,
    );
    if (!terminal || progress.finalizedJobId === syncJob.id) return;
    progress.finalizedJobId = syncJob.id;
    void Promise.all([
      queryClient.invalidateQueries({
        queryKey: ['connected-accounts', currentUser.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ['account-analytics', currentUser.id, selectedId],
      }),
    ]);
    if (syncJob.status === 'SUCCEEDED') {
      setMessage(
        'Available history sync completed. The report has been refreshed.',
      );
    } else if (syncJob.status === 'PARTIAL') {
      setMessage(
        `History sync completed with gaps or failed sections (${syncJob.successfulChunks} of ${syncJob.totalChunks} sections succeeded).`,
      );
    } else if (syncJob.status === 'FAILED') {
      setError(
        friendlySyncError(
          syncJob.finalErrorCode ?? syncJob.errors[0]?.code ?? null,
        ) ?? 'History sync failed. Retry the sync or reconnect this account.',
      );
    }
  }, [currentUser.id, queryClient, selectedId, syncJob, syncJobAccountId]);
  const emailQuery = useQuery({
    queryKey: ['account-email-report', currentUser.id, selectedId, from, to],
    enabled: Boolean(
      view === 'email-reports' && selected?.kind === 'EMAIL' && from && to,
    ),
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
    enabled:
      view === 'account-comparison' &&
      comparisonAccounts.length >= 2 &&
      Boolean(from && to),
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
  const visibleEmailCampaigns = useMemo(() => {
    const term = campaignSearch.trim().toLocaleLowerCase();
    return (email?.campaigns ?? []).filter((campaign) =>
      campaign.name.toLocaleLowerCase().includes(term),
    );
  }, [campaignSearch, email?.campaigns]);
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
    date: point.date,
    value: chosenChartMetric
      ? (point.values[chosenChartMetric.code] ?? null)
      : null,
  }));
  const growthPoints = (analytics?.series ?? []).map((point) => ({
    date: point.date,
    value: point.values.AUDIENCE_CHANGE ?? null,
  }));

  function setPeriod(days: 30 | 90 | 365) {
    const end = dayInTimezone(timezone);
    setFrom(dayInTimezone(timezone, -(days - 1)));
    setTo(end);
    setPeriodPreset(String(days) as '30' | '90' | '365');
  }

  function setCustomFrom(value: string) {
    setFrom(value);
    setPeriodPreset('CUSTOM');
  }

  function setCustomTo(value: string) {
    setTo(value);
    setPeriodPreset('CUSTOM');
  }

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
      if (
        selected.provider === 'INSTAGRAM' ||
        selected.provider === 'FACEBOOK'
      ) {
        const job = await apiRequest<SyncJob>(
          `/accounts/${selected.id}/sync-jobs`,
          { method: 'POST', body: { from, to } },
        );
        setSyncJobId(job.id);
        setSyncJobAccountId(selected.id);
        setMessage(
          job.status === 'QUEUED' || job.status === 'RUNNING'
            ? job.completedChunks > 0
              ? `History sync resumed: ${job.completedChunks} of ${job.totalChunks} sections complete.`
              : 'Available history is queued. Saved report data remains available while it runs.'
            : 'Available history sync has completed.',
        );
      } else {
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
      }
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
        `Disconnect ${account.displayName}? Syncing will stop and its permitted historical analytics will remain available.`,
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
        `${account.displayName} was disconnected. Historical analytics were retained. ${revocationMessage}`,
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

  async function deleteAccountData(account: ConnectedAccount) {
    if (
      !window.confirm(
        `Permanently delete ${account.displayName} and all retained analytics history? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiRequest(`/accounts/${account.id}/data`, { method: 'DELETE' });
      await queryClient.invalidateQueries({
        queryKey: ['connected-accounts', currentUser.id],
      });
      if (selectedId === account.id) setSelectedId('');
      setMessage(
        `${account.displayName} and its retained analytics history were deleted.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not delete this account’s stored data.',
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
  const screenTitle =
    view === 'account-insights'
      ? selected?.kind === 'SOCIAL'
        ? selected.displayName
        : 'Account insights'
      : view === 'account-comparison'
        ? 'Compare connected accounts'
        : 'Email performance';
  const screenDescription =
    view === 'account-insights'
      ? 'Provider-specific trends and content for the selected reporting period.'
      : view === 'account-comparison'
        ? 'Choose two to four accounts. Each metric keeps its provider meaning and scope.'
        : 'Zoho campaign results grouped by sent date and kept separate from social analytics.';

  return (
    <div className="accounts-page" data-screen={view}>
      {view === 'accounts' ? (
        <section className="accounts-home-heading">
          <PageHeading
            eyebrow="Account-first analytics"
            title="Your connected accounts"
            description="Monitor social channels and email reporting from one place. Paid campaign results remain in Campaigns."
            actions={
              <button
                className="primary"
                type="button"
                ref={connectButtonRef}
                id="connect-account-button"
                aria-expanded={providersOpen}
                aria-controls="account-provider-options"
                onClick={() => setProvidersOpen((open) => !open)}
              >
                <span aria-hidden="true">＋</span> Connect account
              </button>
            }
          />
          <div className="account-hero">
            <div>
              <span className="account-hero-kicker">Workspace pulse</span>
              <h2>See the full picture.</h2>
              <p>Your channels, performance, and reports in one workspace.</p>
            </div>
            <div className="account-hero-count">
              <span>Connected sources</span>
              <strong>{accounts.length}</strong>
              <small>
                {socialAccounts.length} social · {emailAccounts.length} email
              </small>
            </div>
          </div>
        </section>
      ) : (
        <section className="account-screen-toolbar">
          <PageHeading
            eyebrow={
              view === 'account-insights'
                ? `${selected ? providerNames[selected.provider] : 'Social'} insights`
                : view === 'account-comparison'
                  ? 'Side by side, without misleading totals'
                  : 'Zoho Campaigns cumulative reporting'
            }
            title={screenTitle}
            description={screenDescription}
            actions={
              <>
                {view === 'account-insights' && (
                  <label className="account-toolbar-select">
                    <span className="sr-only">Select a social account</span>
                    <select
                      value={selected?.kind === 'SOCIAL' ? selected.id : ''}
                      onChange={(event) => setSelectedId(event.target.value)}
                      aria-label="Select a social account"
                    >
                      {socialAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.displayName} ·{' '}
                          {providerNames[account.provider]}
                        </option>
                      ))}
                      {!socialAccounts.length && (
                        <option value="">No social accounts connected</option>
                      )}
                    </select>
                  </label>
                )}
                {view !== 'account-insights' && (
                  <DateRangeControls
                    from={from}
                    to={to}
                    max={dayInTimezone(timezone)}
                    onFromChange={setFrom}
                    onToChange={setTo}
                  />
                )}
              </>
            }
          />
          {view === 'account-insights' && (
            <div className="account-period-picker">
              <div
                className="account-period-presets"
                role="group"
                aria-label="Reporting period"
              >
                <button
                  className={periodPreset === '30' ? 'primary' : 'secondary'}
                  type="button"
                  aria-pressed={periodPreset === '30'}
                  onClick={() => setPeriod(30)}
                >
                  Last 30 days
                </button>
                <button
                  className={periodPreset === '90' ? 'primary' : 'secondary'}
                  type="button"
                  aria-pressed={periodPreset === '90'}
                  onClick={() => setPeriod(90)}
                >
                  Last 90 days
                </button>
                {isMetaAccount && (
                  <button
                    className={periodPreset === '365' ? 'primary' : 'secondary'}
                    type="button"
                    aria-pressed={periodPreset === '365'}
                    onClick={() => setPeriod(365)}
                  >
                    Last 365 days
                  </button>
                )}
                <button
                  className={
                    periodPreset === 'CUSTOM' ? 'primary' : 'secondary'
                  }
                  type="button"
                  aria-pressed={periodPreset === 'CUSTOM'}
                  onClick={() => setPeriodPreset('CUSTOM')}
                >
                  Custom
                </button>
              </div>
              <p className="account-period-summary" aria-live="polite">
                {from} to {to}
              </p>
              {periodPreset === 'CUSTOM' && (
                <DateRangeControls
                  from={from}
                  to={to}
                  max={today}
                  onFromChange={setCustomFrom}
                  onToChange={setCustomTo}
                />
              )}
            </div>
          )}
        </section>
      )}

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

      {view === 'accounts' && (
        <section
          className="panel provider-options-panel"
          id="account-provider-options"
          hidden={!providersOpen}
        >
          <div className="panel-heading">
            <div>
              <h2>Choose a connection</h2>
              <p>
                Authorize a social profile or email service. Connection setup is
                separate from campaign creation.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => {
                setProvidersOpen(false);
                connectButtonRef.current?.focus();
              }}
              aria-label="Close connection options"
            >
              ×
            </button>
          </div>
          {!canConnect && (
            <div className="notice">
              Ask an Administrator or Marketing Officer to connect accounts.
            </div>
          )}
          {optionsQuery.isError ? (
            <div className="account-empty" role="alert">
              <strong>Connection options could not be loaded</strong>
              <span>
                {optionsQuery.error instanceof Error
                  ? optionsQuery.error.message
                  : 'Try loading the provider setup again.'}
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => void optionsQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : optionsQuery.isLoading ? (
            <p role="status">Loading provider setup…</p>
          ) : (
            <div className="provider-grid">
              {setupProviders.map((setup) => (
                <article className="provider-card" key={setup.provider}>
                  <div className="provider-title-row">
                    <ProviderMark provider={setup.provider} />
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
                  {
                    <details className="setup-details">
                      <summary>
                        What the workspace administrator needs to configure
                      </summary>
                      {setup.notes.map((note) => (
                        <p className="provider-note" key={note}>
                          {note}
                        </p>
                      ))}
                      <span>
                        Required server settings: {setup.missing.join(', ')}.
                      </span>
                      <span>
                        Requested permissions: {setup.scopes.join(', ')}.
                      </span>
                    </details>
                  }
                </article>
              ))}
              {!setupProviders.length && (
                <div className="account-empty">
                  <strong>No provider connections are configured</strong>
                  <span>Ask an Administrator to review workspace setup.</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {view === 'accounts' && (
        <section className="panel connected-accounts-panel">
          <div className="panel-heading">
            <div>
              <h2>Social accounts</h2>
              <p>Select a source to explore its own insights.</p>
            </div>
            <button
              className="text-link"
              type="button"
              onClick={() => navigate('account-comparison')}
              disabled={socialAccounts.length < 2}
            >
              View comparison <span aria-hidden="true">›</span>
            </button>
          </div>
          {accountsQuery.isLoading ? (
            <p role="status">Loading connected accounts…</p>
          ) : accountsQuery.isError ? (
            <div className="account-empty" role="alert">
              <strong>Connected accounts could not be loaded</strong>
              <span>
                {accountsQuery.error instanceof Error
                  ? accountsQuery.error.message
                  : 'Try loading your accounts again.'}
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => void accountsQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : socialAccounts.length ? (
            <div
              className="connected-account-list"
              role="list"
              aria-label="Connected social accounts"
            >
              {socialAccounts.map((account, index) => {
                const health = syncHealth(account);
                const summaryQuery = accountSummaryQueries[index];
                const summaryMetric =
                  summaryQuery?.data?.metrics.find(
                    (metric) =>
                      metric.code === 'AUDIENCE_SIZE' && metric.value !== null,
                  ) ??
                  summaryQuery?.data?.metrics.find(
                    (metric) => metric.value !== null,
                  );
                return (
                  <div
                    className={`connected-account ${selectedId === account.id ? 'selected' : ''}`}
                    key={account.id}
                    role="listitem"
                  >
                    <button
                      className="connected-account-select"
                      type="button"
                      onClick={() => {
                        setSelectedId(account.id);
                        navigate('account-insights');
                      }}
                      aria-pressed={selectedId === account.id}
                    >
                      <span className="connected-account-card-top">
                        <ProviderMark provider={account.provider} />
                        <StatusPill tone={health.tone}>
                          {health.label}
                        </StatusPill>
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
                      <span className="account-summary-value">
                        <small>
                          {summaryMetric?.label ??
                            (summaryQuery?.isLoading
                              ? 'Loading account summary'
                              : 'Account summary')}
                        </small>
                        <strong>
                          {summaryMetric
                            ? formatValue(
                                summaryMetric.value,
                                summaryMetric.unit,
                              )
                            : summaryQuery?.error
                              ? 'Unavailable'
                              : 'No recent data'}
                        </strong>
                      </span>
                      <span className="connected-account-sync">
                        <span className={`sync-dot sync-dot-${health.tone}`} />
                        <small>{health.detail}</small>
                      </span>
                      <span className="connected-account-open">
                        Open insights <span aria-hidden="true">→</span>
                      </span>
                    </button>
                    {isAdmin && (
                      <div className="connected-account-management">
                        {account.active ? (
                          <button
                            className="text-button disconnect-button"
                            type="button"
                            disabled={busy}
                            onClick={() => void disconnectAccount(account)}
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            className="text-button disconnect-button"
                            type="button"
                            disabled={busy}
                            onClick={() => void deleteAccountData(account)}
                          >
                            Delete stored data
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="account-empty">
              <strong>No social accounts connected</strong>
              <span>
                Connect Instagram, Facebook, LinkedIn, or YouTube to see their
                independent account results.
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => setProvidersOpen(true)}
              >
                Choose a social provider
              </button>
            </div>
          )}
          <section
            className="email-connections"
            aria-labelledby="email-connections-title"
          >
            <div className="panel-heading">
              <div>
                <h2 id="email-connections-title">Email reporting</h2>
                <p>
                  Zoho campaign results stay separate from social analytics.
                </p>
              </div>
              <span className="account-badge">
                {emailAccounts.length} connected
              </span>
            </div>
            {emailAccounts.length ? (
              <div className="email-connection-list">
                {emailAccounts.map((account) => {
                  const health = syncHealth(account);
                  return (
                    <article className="email-connection-card" key={account.id}>
                      <ProviderMark provider={account.provider} />
                      <div className="email-connection-copy">
                        <strong>{account.displayName}</strong>
                        <small>
                          Zoho Campaigns · cumulative campaign reporting
                        </small>
                        <span
                          className={`connection-health health-${health.tone}`}
                        >
                          {health.label} · {health.detail}
                        </span>
                      </div>
                      <button
                        className="secondary"
                        type="button"
                        onClick={() => {
                          setSelectedId(account.id);
                          navigate('email-reports');
                        }}
                      >
                        Open report <span aria-hidden="true">→</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="email-connection-empty">
                <p>No Zoho reporting connection yet.</p>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setProvidersOpen(true)}
                >
                  Connect Zoho Campaigns <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </section>
        </section>
      )}

      {view === 'account-comparison' && (
        <section className="panel account-comparison-panel">
          <div className="panel-heading">
            <div>
              <h2>Social performance</h2>
              <p>
                Compare two to four accounts for {from} to {to}. Metrics stay
                with their provider definitions; values are never added across
                platforms.
              </p>
            </div>
            <div className="account-actions">
              <button
                className="secondary export-button"
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
          <InfoBanner>
            Comparisons show change within each account. Similar metric names
            may represent different provider measurements.
          </InfoBanner>
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
          {accountsQuery.isLoading ? (
            <p role="status">Loading connected accounts…</p>
          ) : accountsQuery.isError ? (
            <div className="account-empty" role="alert">
              <strong>Connected accounts could not be loaded</strong>
              <span>
                {accountsQuery.error instanceof Error
                  ? accountsQuery.error.message
                  : 'Try loading your accounts again.'}
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => void accountsQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : comparisonAccounts.length < 2 ? (
            <div role="status">
              <p>Select at least two accounts to compare.</p>
              <button
                className="secondary"
                onClick={() => navigate('accounts')}
              >
                Connect accounts
              </button>
            </div>
          ) : comparisonQuery.isLoading ? (
            <p role="status">Loading account comparison…</p>
          ) : comparisonQuery.error instanceof Error ? (
            <div className="notice error" role="alert">
              {comparisonQuery.error.message}
            </div>
          ) : comparisonReports.length ? (
            <div className="comparison-account-grid">
              {comparisonReports.map((report) => {
                const trendMetric = report.metrics.find(
                  (metric) =>
                    metric.mode === 'SUM' &&
                    report.series.some(
                      (point) => typeof point.values[metric.code] === 'number',
                    ),
                );
                const trend = trendMetric
                  ? report.series.map((point) => ({
                      date: point.date,
                      value: point.values[trendMetric.code] ?? null,
                    }))
                  : [];
                return (
                  <article
                    className="comparison-account-card"
                    key={report.account.id}
                  >
                    <header className="comparison-account-heading">
                      <ProviderMark provider={report.account.provider} />
                      <div>
                        <h3>{report.account.displayName}</h3>
                        <p>{providerNames[report.account.provider]}</p>
                      </div>
                      <StatusPill
                        tone={report.account.active ? 'current' : 'stale'}
                      >
                        {report.account.active ? 'Connected' : 'Disconnected'}
                      </StatusPill>
                    </header>
                    <dl className="comparison-metric-list">
                      {report.metrics.map((metric) => (
                        <div className="comparison-metric" key={metric.code}>
                          <dt>{metric.label}</dt>
                          <dd>
                            <strong>
                              {formatValue(metric.value, metric.unit)}
                            </strong>
                            <span>
                              {metric.mode === 'SNAPSHOT'
                                ? metric.coverage.snapshotDate
                                  ? `Snapshot observed ${metric.coverage.snapshotDate}`
                                  : 'No saved history for this period'
                                : metric.coverage.status === 'PARTIAL'
                                  ? `Partial total — ${metric.coverage.observedDays ?? 0} of ${metric.coverage.requestedDays ?? report.coverage.requestedDays} days available`
                                  : metric.coverage.status === 'NONE'
                                    ? 'No saved history for this period'
                                    : metric.difference === null
                                      ? 'Comparison unavailable'
                                      : `${metric.difference > 0 ? '+' : ''}${formatValue(metric.difference, metric.unit)} vs previous period${metric.percentageChange === null ? '' : ` (${metric.percentageChange > 0 ? '+' : ''}${metric.percentageChange}%)`}`}
                            </span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {trendMetric && (
                      <section className="comparison-trend">
                        <div className="comparison-trend-heading">
                          <h4>Daily {trendMetric.label.toLowerCase()}</h4>
                          <span>
                            {from} – {to}
                          </span>
                        </div>
                        <div
                          className="comparison-trend-chart"
                          role="img"
                          aria-label={`Daily ${trendMetric.label}; exact values are available in the chart tooltip.`}
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trend} accessibilityLayer>
                              <CartesianGrid
                                stroke="#e9eef6"
                                strokeDasharray="3 3"
                              />
                              <XAxis
                                dataKey="date"
                                minTickGap={20}
                                tick={{ fontSize: 8, fill: '#8a9bb1' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value: string) =>
                                  report.coverage.requestedDays > 100
                                    ? value.slice(0, 7)
                                    : value.slice(5)
                                }
                              />
                              <YAxis
                                width={44}
                                tick={{ fontSize: 8, fill: '#8a9bb1' }}
                                label={{
                                  value: `${trendMetric.label} (${trendMetric.unit === 'COUNT' ? 'count' : trendMetric.unit.toLowerCase()})`,
                                  angle: -90,
                                  position: 'insideLeft',
                                  fontSize: 8,
                                }}
                              />
                              <Tooltip
                                labelFormatter={(value) => `Date: ${value}`}
                                formatter={(value) => [
                                  formatValue(
                                    typeof value === 'number' ? value : null,
                                    trendMetric.unit,
                                  ),
                                  trendMetric.label,
                                ]}
                              />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#3978f6"
                                strokeWidth={2}
                                dot={false}
                                connectNulls={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </section>
                    )}
                    <div className="comparison-top-content">
                      <div className="comparison-content-heading">
                        <h4>Top content by account</h4>
                        <p>
                          {report.topPosts[0]
                            ? `Ranked by ${formatProviderMetric(report.topPosts[0].metricCode)}`
                            : 'Provider content measurements'}
                        </p>
                      </div>
                      {report.topPosts.length ? (
                        <ol>
                          {report.topPosts.slice(0, 3).map((post, index) => (
                            <li
                              key={`${post.externalPostId}-${post.metricCode}`}
                            >
                              <span className="content-rank">
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <span className="comparison-content-name">
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
                                <small>
                                  {formatValue(post.metricValue, 'COUNT')} ·{' '}
                                  {post.dataScope === 'LIFETIME'
                                    ? 'Lifetime'
                                    : 'Selected period'}
                                </small>
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="comparison-no-content">
                          No top content is available for this date range.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      )}

      {view === 'account-insights' && selected?.kind === 'SOCIAL' && (
        <section className="panel account-dashboard">
          <div className="panel-heading account-dashboard-heading">
            <div>
              <div className="account-insight-source">
                <ProviderMark provider={selected.provider} />
                <div>
                  <p className="eyebrow">
                    {providerNames[selected.provider]} account
                  </p>
                  <h2>{selected.displayName}</h2>
                </div>
                <StatusPill
                  tone={selected.active ? syncHealth(selected).tone : 'stale'}
                >
                  {syncHealth(selected).label}
                </StatusPill>
              </div>
              <p>
                {from} to {to} · Compared with the preceding period of equal
                length
              </p>
              {!selected.active && (
                <p className="disconnected-note" role="status">
                  This account is disconnected. Historical analytics remain
                  available.
                </p>
              )}
            </div>
            <div className="account-actions">
              {canConnect &&
                (selected.lastSyncErrorCode === 'TOKEN_EXPIRED' ||
                  selected.lastSyncErrorCode ===
                    'REAUTHENTICATION_REQUIRED') && (
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => void connect(selected.provider)}
                  >
                    Reconnect account
                  </button>
                )}
              <button
                className="primary"
                type="button"
                disabled={
                  !canConnect ||
                  !selected.active ||
                  busy ||
                  Boolean(
                    syncJob?.status === 'QUEUED' ||
                    syncJob?.status === 'RUNNING' ||
                    activeSyncJob?.status === 'QUEUED' ||
                    activeSyncJob?.status === 'RUNNING',
                  )
                }
                onClick={() => void syncNow()}
              >
                {busy
                  ? isMetaAccount
                    ? 'Queueing…'
                    : 'Working…'
                  : isMetaAccount
                    ? 'Sync available history'
                    : 'Sync this period'}
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
            {!canConnect && (
              <p className="permission-hint" role="status">
                Management access is view only. An Administrator or Marketing
                Officer can request a sync.
              </p>
            )}
          </div>
          {isMetaAccount && syncJob && (
            <div className="sync-job-status" role="status" aria-live="polite">
              <div className="sync-job-status-copy">
                <strong>
                  {syncJob.status === 'QUEUED'
                    ? 'History sync queued'
                    : syncJob.status === 'RUNNING'
                      ? `Fetching available history — ${syncJob.completedChunks} of ${syncJob.totalChunks} sections`
                      : syncJob.status === 'SUCCEEDED'
                        ? 'History sync completed'
                        : syncJob.status === 'PARTIAL'
                          ? 'History sync completed with gaps or failures'
                          : syncJob.status === 'CANCELLED'
                            ? 'History sync cancelled'
                            : 'History sync failed'}
                </strong>
                <span>
                  {syncJob.fetchablePeriod
                    ? `Provider fetch window: ${syncJob.fetchablePeriod.from} to ${syncJob.fetchablePeriod.to}.`
                    : 'No dates in this report are currently available from the provider.'}
                  {syncJob.status === 'RUNNING' || syncJob.status === 'QUEUED'
                    ? ' Saved report data remains available while syncing.'
                    : ''}
                  {syncJob.status === 'PARTIAL' &&
                    ` ${syncJob.failedChunks} sections need retry or reconnect.`}
                  {syncJob.status === 'FAILED' &&
                    ` ${friendlySyncError(syncJob.finalErrorCode ?? syncJob.errors[0]?.code ?? null) ?? 'Retry the sync or reconnect the account.'}`}
                </span>
              </div>
              {(syncJob.status === 'QUEUED' ||
                syncJob.status === 'RUNNING') && (
                <progress
                  max={Math.max(syncJob.totalChunks, 1)}
                  value={syncJob.completedChunks}
                  aria-label={`History sync progress: ${syncJob.completedChunks} of ${syncJob.totalChunks} sections`}
                />
              )}
            </div>
          )}
          {isMetaAccount && selected.provider === 'INSTAGRAM' && (
            <p className="meta-history-note">
              Instagram supplies recent account history. Older saved days remain
              available in Marketwise.
            </p>
          )}
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
                  <MetricTile
                    key={metric.code}
                    label={metric.label}
                    value={formatValue(metric.value, metric.unit)}
                    detail={
                      metric.mode === 'SNAPSHOT' ? (
                        metric.coverage.snapshotDate ? (
                          `Snapshot observed ${metric.coverage.snapshotDate}`
                        ) : (
                          'No saved history for this period'
                        )
                      ) : metric.coverage.status === 'PARTIAL' ? (
                        `Partial total — ${metric.coverage.observedDays ?? 0} of ${metric.coverage.requestedDays ?? analytics.coverage.requestedDays} days available`
                      ) : metric.coverage.status === 'NONE' ? (
                        'No saved history for this period'
                      ) : metric.difference === null ? (
                        'Comparison unavailable'
                      ) : (
                        <>
                          <span className="trend-indicator" aria-hidden="true">
                            {metric.difference > 0
                              ? '↑'
                              : metric.difference < 0
                                ? '↓'
                                : '→'}
                          </span>{' '}
                          {metric.difference > 0 ? '+' : ''}
                          {formatValue(metric.difference, metric.unit)} vs
                          previous period
                          {metric.percentageChange === null
                            ? ''
                            : ` (${metric.percentageChange > 0 ? '+' : ''}${metric.percentageChange}%)`}
                        </>
                      )
                    }
                  />
                ))}
              </div>
              {(isMetaAccount
                ? analytics.coverage.latestSuccessfulHistoryFetchAt
                : analytics.dataAvailableThrough) && (
                <p className="data-freshness">
                  {isMetaAccount
                    ? 'Latest successful history fetch '
                    : 'Provider data available through '}
                  {formatDateTime(
                    (isMetaAccount
                      ? analytics.coverage.latestSuccessfulHistoryFetchAt
                      : analytics.dataAvailableThrough) as string,
                  )}
                  . This timestamp does not mean every report date has data.
                </p>
              )}

              <div className="account-chart-grid">
                <section className="account-chart-card">
                  <div className="account-chart-heading">
                    <div>
                      <h3>Daily content activity</h3>
                      <p>
                        {chosenChartMetric
                          ? `${chosenChartMetric.label} (${chosenChartMetric.unit === 'COUNT' ? 'count' : chosenChartMetric.unit.toLowerCase()}) by date. Missing days remain gaps.`
                          : 'Daily totals use the provider’s metric definition.'}
                      </p>
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
                            tickFormatter={(value: string) =>
                              analytics.coverage.requestedDays > 100
                                ? value.slice(0, 7)
                                : value.slice(5)
                            }
                          />
                          <YAxis
                            width={48}
                            label={{
                              value: `${chosenChartMetric.label} (${chosenChartMetric.unit === 'COUNT' ? 'count' : chosenChartMetric.unit.toLowerCase()})`,
                              angle: -90,
                              position: 'insideLeft',
                            }}
                            tickFormatter={(value: number) =>
                              new Intl.NumberFormat(undefined, {
                                notation: 'compact',
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            labelFormatter={(value) => `Date: ${value}`}
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
                      {analytics.metrics.every(
                        (metric) => metric.coverage.status === 'NONE',
                      )
                        ? isMetaAccount
                          ? 'No saved history is available for these dates. Sync available history to request dates the provider can still supply.'
                          : 'No saved history is available for these dates. Sync this period to request provider data.'
                        : 'No activity values are available for this metric in the selected period.'}
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
                            tickFormatter={(value: string) =>
                              analytics.coverage.requestedDays > 100
                                ? value.slice(0, 7)
                                : value.slice(5)
                            }
                          />
                          <YAxis
                            width={48}
                            label={{
                              value: 'Audience change (count)',
                              angle: -90,
                              position: 'insideLeft',
                            }}
                            tickFormatter={(value: number) =>
                              new Intl.NumberFormat(undefined, {
                                notation: 'compact',
                                maximumFractionDigits: 1,
                              }).format(value)
                            }
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            labelFormatter={(value) => `Date: ${value}`}
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
                    <h3>{isMetaAccount ? 'Recent content' : 'Top content'}</h3>
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
                      {isMetaAccount &&
                        ` Content snapshots are retained for ${analytics.coverage.postSnapshotRetentionDays ?? 90} days; this is not a full-year content ranking.`}
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
                    {isMetaAccount
                      ? `No recent content snapshots are available. Meta post snapshots are retained for ${analytics.coverage.postSnapshotRetentionDays ?? 90} days; account metrics can still cover a longer period.`
                      : 'No top content is available for this period. Sync the exact date range to refresh content results.'}
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

      {view === 'account-insights' && selected?.kind !== 'SOCIAL' && (
        <section className="panel account-empty account-empty-panel">
          {accountsQuery.isLoading ? (
            <p role="status">Loading connected accounts…</p>
          ) : accountsQuery.isError ? (
            <>
              <strong>Connected accounts could not be loaded</strong>
              <span>
                {accountsQuery.error instanceof Error
                  ? accountsQuery.error.message
                  : 'Try loading your accounts again.'}
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => void accountsQuery.refetch()}
              >
                Try again
              </button>
            </>
          ) : socialAccounts.length ? (
            <>
              <strong>Select a social account to view insights</strong>
              <span>Choose an account from the selector above.</span>
            </>
          ) : (
            <>
              <strong>No social accounts connected</strong>
              <span>
                Connect an eligible social account to begin reporting.
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => navigate('accounts')}
              >
                Go to Accounts
              </button>
            </>
          )}
        </section>
      )}

      {view === 'email-reports' && (
        <section className="panel email-report-panel">
          <div className="panel-heading">
            <div>
              <div className="account-insight-source">
                <ProviderMark provider="ZOHO_CAMPAIGNS" />
                <div>
                  <h2>Email performance</h2>
                  <p>Zoho Campaigns · reports grouped by campaign send date</p>
                </div>
              </div>
            </div>
            {emailAccounts.length > 0 && (
              <span className="account-badge">
                {emailAccounts.length} connected
              </span>
            )}
          </div>
          {accountsQuery.isError ? (
            <div className="account-empty" role="alert">
              <strong>Email reporting accounts could not be loaded</strong>
              <span>
                {accountsQuery.error instanceof Error
                  ? accountsQuery.error.message
                  : 'Try loading your connected accounts again.'}
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => void accountsQuery.refetch()}
              >
                Try again
              </button>
            </div>
          ) : emailAccounts.length ? (
            <>
              <InfoBanner>
                Zoho reports are cumulative per campaign. Rates are provider
                reported; they are not daily engagement totals. Search filters
                the campaign chart and table; summary totals cover the full date
                range.
              </InfoBanner>
              <div className="email-account-select-row">
                <label>
                  Zoho account
                  <select
                    value={selected?.kind === 'EMAIL' ? selected.id : ''}
                    onChange={(event) => setSelectedId(event.target.value)}
                  >
                    <option value="" disabled>
                      Choose a Zoho account
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
                    {canConnect &&
                      (selected.lastSyncErrorCode === 'TOKEN_EXPIRED' ||
                        selected.lastSyncErrorCode ===
                          'REAUTHENTICATION_REQUIRED') && (
                        <button
                          className="secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => void connect(selected.provider)}
                        >
                          Reconnect account
                        </button>
                      )}
                    <button
                      className="secondary"
                      type="button"
                      disabled={!canConnect || !selected.active || busy}
                      onClick={() => void syncNow()}
                    >
                      {busy ? 'Working…' : 'Refresh report data'}
                    </button>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => void downloadReport(true)}
                    >
                      Download PDF report
                    </button>
                  </div>
                )}
              </div>
              {!canConnect && selected?.kind === 'EMAIL' && (
                <p className="permission-hint" role="status">
                  Management access is view only. An Administrator or Marketing
                  Officer can refresh provider data.
                </p>
              )}
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
                          <MetricTile
                            key={code}
                            label={formatProviderMetric(code)}
                            value={formatValue(
                              value,
                              code === 'OPEN_RATE' ||
                                code === 'UNIQUE_CLICK_RATE'
                                ? 'PERCENT'
                                : 'COUNT',
                            )}
                            detail={
                              code === 'OPEN_RATE' ||
                              code === 'UNIQUE_CLICK_RATE'
                                ? 'Zoho-reported rate'
                                : 'Cumulative total'
                            }
                          />
                        ))}
                      </div>
                      <div className="email-campaign-filter">
                        <label>
                          <span>Filter campaigns</span>
                          <input
                            type="search"
                            value={campaignSearch}
                            onChange={(event) =>
                              setCampaignSearch(event.target.value)
                            }
                            placeholder="Search campaign names"
                          />
                        </label>
                        <small>
                          Showing {visibleEmailCampaigns.length} of{' '}
                          {email.campaigns.length} campaigns
                        </small>
                      </div>
                      {visibleEmailCampaigns.length ? (
                        <>
                          <section className="email-engagement-panel">
                            <div className="account-chart-heading">
                              <div>
                                <h3>Campaign engagement</h3>
                                <p>
                                  Zoho-reported open and unique-click rates by
                                  campaign.
                                </p>
                              </div>
                              <span className="chart-legend">
                                <span>
                                  <i className="legend-dot legend-open" />
                                  Open rate
                                </span>
                                <span>
                                  <i className="legend-dot legend-click" />
                                  Unique-click rate
                                </span>
                              </span>
                            </div>
                            {visibleEmailCampaigns.some(
                              (campaign) =>
                                typeof campaign.metricValues.OPEN_RATE ===
                                  'number' ||
                                typeof campaign.metricValues
                                  .UNIQUE_CLICK_RATE === 'number',
                            ) ? (
                              <div
                                className="email-engagement-chart"
                                role="img"
                                aria-label="Zoho-reported open and unique-click rates by campaign"
                              >
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={visibleEmailCampaigns.map(
                                      (campaign) => ({
                                        name: campaign.name,
                                        openRate:
                                          campaign.metricValues.OPEN_RATE,
                                        clickRate:
                                          campaign.metricValues
                                            .UNIQUE_CLICK_RATE,
                                      }),
                                    )}
                                    layout="vertical"
                                    margin={{
                                      left: 4,
                                      right: 14,
                                      top: 8,
                                      bottom: 0,
                                    }}
                                  >
                                    <CartesianGrid
                                      stroke="#e6ecf5"
                                      strokeDasharray="3 3"
                                      vertical
                                      horizontal={false}
                                    />
                                    <XAxis
                                      type="number"
                                      domain={[0, 'dataMax']}
                                      tickFormatter={(value: number) =>
                                        `${value}%`
                                      }
                                      tick={{ fontSize: 11, fill: '#7a8ba5' }}
                                      axisLine={false}
                                      tickLine={false}
                                    />
                                    <YAxis
                                      type="category"
                                      dataKey="name"
                                      width={140}
                                      tick={{ fontSize: 11, fill: '#536781' }}
                                      axisLine={false}
                                      tickLine={false}
                                    />
                                    <Tooltip
                                      formatter={(value, name) => [
                                        formatValue(
                                          typeof value === 'number'
                                            ? value
                                            : null,
                                          'PERCENT',
                                        ),
                                        name === 'openRate'
                                          ? 'Zoho-reported open rate'
                                          : 'Zoho-reported unique-click rate',
                                      ]}
                                    />
                                    <Bar
                                      dataKey="openRate"
                                      name="Open rate"
                                      fill="#3978f6"
                                      radius={[0, 4, 4, 0]}
                                      maxBarSize={12}
                                    />
                                    <Bar
                                      dataKey="clickRate"
                                      name="Unique-click rate"
                                      fill="#22aa9b"
                                      radius={[0, 4, 4, 0]}
                                      maxBarSize={12}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="account-chart-empty">
                                Zoho has not returned campaign rates for this
                                period.
                              </div>
                            )}
                          </section>
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
                                {visibleEmailCampaigns.map((campaign) => (
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
                                        campaign.metricValues.UNIQUE_CLICKS ??
                                          null,
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
                                        campaign.metricValues
                                          .UNIQUE_CLICK_RATE ?? null,
                                        'PERCENT',
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div className="account-chart-empty">
                          {email.campaigns.length
                            ? 'No campaigns match this search.'
                            : 'No sent campaigns were found in this date range.'}
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
                Connect Zoho Campaigns to see email results in this separate
                report.
              </span>
              <button
                className="secondary"
                type="button"
                onClick={() => navigate('accounts')}
              >
                Go to Accounts
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
