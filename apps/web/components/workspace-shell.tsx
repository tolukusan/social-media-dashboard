'use client';
import { AccessManagement } from '../features/access/access-management';
import { Archive } from '../features/archive/archive';

import { useEffect, useRef, useState } from 'react';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { AuthLoading, Login } from '../features/auth/login';
import { useSession } from '../features/auth/use-session';
import { WorkspaceNavigation, SectionNavigation } from './workspace-navigation';
import { Campaigns } from '../features/campaigns/campaigns';
import { Performance } from '../features/performance/performance';
import { DatasetWorkspace } from '../features/datasets/dataset-workspace';
import { DatasetReports } from '../features/datasets/dataset-reports';
import { CatalogueManagement } from '../features/catalogue/catalogue-management';
import { Users } from '../features/users/users';
import { Profile } from '../features/users/profile';
import { Targets } from '../features/targets/targets';
import { Analytics } from '../features/analytics/analytics';
import { ReportingSettings } from '../features/settings/reporting-settings';
import { Integrations } from '../features/integrations/integrations';
import { Accounts } from '../features/accounts/accounts';
import type {
  View,
  AuthStatus,
  DashboardResult,
  Campaign,
  Channel,
  PerformanceRecord,
  TrendResult,
} from '../lib/workspace-types';
import { ApiError, apiRequest, queryKeys } from '../lib/api-client';

type AccountView = Extract<
  View,
  'accounts' | 'account-insights' | 'account-comparison' | 'email-reports'
>;

const accountViews = new Set<AccountView>([
  'accounts',
  'account-insights',
  'account-comparison',
  'email-reports',
]);

function isAccountView(view: View): view is AccountView {
  return accountViews.has(view as AccountView);
}

export function WorkspaceShell() {
  const queryClient = useQueryClient();
  const sessionQuery = useSession();
  const currentUser = sessionQuery.data ?? null;
  const authStatus: AuthStatus = sessionQuery.isPending
    ? 'checking'
    : currentUser
      ? 'authenticated'
      : 'unauthenticated';
  const [authError, setAuthError] = useState('');
  const identityRef = useRef<string | null>(null);
  const lastHashRef = useRef<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [datasetDraftPending, setDatasetDraftPending] = useState(false);
  const roleCode = currentUser?.role.code;
  useEffect(() => {
    const restoreView = () => {
      const callback = new URLSearchParams(window.location.search).has(
        'accountConnection',
      );
      if (callback && !window.location.hash)
        window.history.replaceState(
          null,
          '',
          `${window.location.pathname}${window.location.search}#accounts`,
        );
      const raw = window.location.hash.slice(1);
      if (lastHashRef.current !== null && raw !== lastHashRef.current) {
        if (
          datasetDraftPending &&
          !window.confirm(
            'Leave this page and discard the unfinished dataset upload?',
          )
        ) {
          window.history.forward();
          return;
        }
        if (datasetDraftPending) setDatasetDraftPending(false);
      }
      lastHashRef.current = raw;
      const next =
        (
          {
            data: 'datasets',
            administration: 'settings',
            connections: 'integrations',
          } as Record<string, string>
        )[raw] ?? raw;
      const allowed = [
        'accounts',
        'account-insights',
        'account-comparison',
        'email-reports',
        'overview',
        'campaigns',
        'datasets',
        'performance',
        'analytics',
        'targets',
        'reports',
        'profile',
        'integrations',
        ...(roleCode === 'ADMIN' ? ['settings', 'users', 'archive'] : []),
      ];
      setView(
        allowed.includes(next)
          ? (next as View)
          : new URLSearchParams(window.location.search).has('accountConnection')
            ? 'accounts'
            : 'overview',
      );
      setNavigationOpen(false);
    };
    restoreView();
    window.addEventListener('hashchange', restoreView);
    return () => window.removeEventListener('hashchange', restoreView);
  }, [datasetDraftPending, roleCode]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [metricFilter, setMetricFilter] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('');
  const defaultsApplied = useRef(false);
  const filtersRestored = useRef(false);
  const [filtersReady, setFiltersReady] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFrom(params.get('from') || '');
    setTo(params.get('to') || '');
    setCampaignFilter(params.get('campaignId') || '');
    setChannelFilter(params.get('channelId') || '');
    setPlatformFilter(params.get('platformId') || '');
    setMetricFilter(params.get('metricCode') || '');
    filtersRestored.current = Boolean(
      params.has('from') ||
      params.has('to') ||
      params.get('targetPeriod') === 'CAMPAIGN',
    );
    setFiltersReady(true);
  }, []);
  const workspaceFilters = {
    from,
    to,
    campaignId: campaignFilter,
    channelId: channelFilter,
    platformId: platformFilter,
    metricCode: metricFilter,
    targetPeriod,
  };
  const workspaceQuery = useQuery({
    queryKey: ['workspace-context', currentUser?.id ?? 'anonymous'],
    enabled:
      filtersReady && authStatus === 'authenticated' && Boolean(currentUser),
    staleTime: 60_000,
    queryFn: async () => {
      try {
        const [campaigns, channels] = await Promise.all([
          apiRequest<Campaign[]>('/campaigns'),
          apiRequest<Channel[]>('/channels'),
        ]);
        return { campaigns, channels };
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await queryClient.cancelQueries();
          queryClient.clear();
          throw error;
        }
        throw error;
      }
    },
  });
  const dashboardQuery = useQuery({
    placeholderData: keepPreviousData,
    queryKey: currentUser
      ? queryKeys.workspace(currentUser.id, workspaceFilters)
      : ['workspace', 'anonymous'],
    enabled:
      filtersReady && authStatus === 'authenticated' && view === 'analytics',
    queryFn: async () => {
      const params = new URLSearchParams(
        Object.entries(workspaceFilters).filter(([, value]) => Boolean(value)),
      );
      return apiRequest<DashboardResult>(`/analytics/dashboard?${params}`);
    },
  });
  const recordsQuery = useQuery({
    queryKey: ['performance-records', currentUser?.id ?? 'anonymous'],
    enabled:
      filtersReady && authStatus === 'authenticated' && view === 'performance',
    queryFn: () => apiRequest<PerformanceRecord[]>('/performance-records'),
  });
  const defaultPeriodQuery = useQuery({
    queryKey: ['analytics-default-period', currentUser?.id ?? 'anonymous'],
    enabled:
      filtersReady && authStatus === 'authenticated' && view === 'analytics',
    queryFn: () =>
      apiRequest<{ from: string; to: string; hasData: boolean }>(
        '/analytics/default-period',
      ),
  });
  const trendQuery = useQuery({
    queryKey: ['trends', currentUser?.id ?? 'anonymous', workspaceFilters],
    enabled:
      filtersReady &&
      authStatus === 'authenticated' &&
      Boolean(currentUser && from && to) &&
      view === 'analytics',
    queryFn: async () => {
      const params = new URLSearchParams(
        Object.entries(workspaceFilters).filter(([, value]) => Boolean(value)),
      );
      return apiRequest<TrendResult>(`/analytics/trends?${params}`);
    },
  });
  const dashboard = dashboardQuery.data ?? null;
  const campaigns = workspaceQuery.data?.campaigns ?? [];
  const channels = workspaceQuery.data?.channels ?? [];
  const [usersRevision, setUsersRevision] = useState(0);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const records = recordsQuery.data ?? [];
  useEffect(() => {
    if (
      view !== 'analytics' ||
      !filtersReady ||
      !defaultPeriodQuery.data ||
      defaultsApplied.current
    )
      return;
    defaultsApplied.current = true;
    if (!filtersRestored.current && !from && !to) {
      const period = defaultPeriodQuery.data;
      setFrom(period.from);
      setTo(period.to);
    }
  }, [defaultPeriodQuery.data, filtersReady, from, to, view]);
  const loading =
    workspaceQuery.isFetching ||
    dashboardQuery.isFetching ||
    recordsQuery.isFetching;
  const viewTitles: Record<View, string> = {
    archive: 'Archive',
    accounts: 'Accounts',
    'account-insights': 'Account insights',
    'account-comparison': 'Compare accounts',
    'email-reports': 'Email reports',
    overview: 'Overview',
    campaigns: 'Campaigns',
    datasets: 'Data',
    performance: 'Performance data',
    analytics: 'Campaign analytics',
    targets: 'KPI targets',
    reports: 'Reports',
    users: 'Users',
    settings: 'Settings',
    integrations: 'Connections',
    profile: 'My profile',
  };
  const error =
    [workspaceQuery.error, dashboardQuery.error, recordsQuery.error].find(
      (item): item is Error => item instanceof Error,
    )?.message ?? '';

  useEffect(() => {
    const nextId = currentUser?.id ?? null;
    if (identityRef.current && identityRef.current !== nextId) {
      queryClient.removeQueries({ queryKey: ['workspace'] });
      queryClient.removeQueries({ queryKey: ['workspace-context'] });
      queryClient.removeQueries({ queryKey: ['report-preview'] });
      queryClient.removeQueries({ queryKey: ['imports'] });
      queryClient.removeQueries({ queryKey: ['users'] });
    }
    identityRef.current = nextId;
  }, [currentUser?.id, queryClient]);

  useEffect(() => {
    const queryError = [
      workspaceQuery.error,
      dashboardQuery.error,
      recordsQuery.error,
      defaultPeriodQuery.error,
      trendQuery.error,
    ].find((item): item is ApiError => item instanceof ApiError);
    if (queryError?.status === 401) {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, null);
    }
  }, [
    dashboardQuery.error,
    defaultPeriodQuery.error,
    queryClient,
    recordsQuery.error,
    trendQuery.error,
    workspaceQuery.error,
  ]);

  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
    });
  };

  if (authStatus === 'checking') return <AuthLoading />;
  if (authStatus === 'unauthenticated')
    return (
      <Login
        error={authError}
        onSuccess={async () => {
          setAuthError('');
          await sessionQuery.refetch();
        }}
        onError={setAuthError}
      />
    );

  const navigate = (next: View) => {
    setView(next);
    setNavigationOpen(false);
    window.location.hash = next;
  };
  const canLeaveDatasetDraft = () => {
    if (!datasetDraftPending) return true;
    const approved = window.confirm(
      'Leave this page and discard the unfinished dataset upload?',
    );
    if (approved) setDatasetDraftPending(false);
    return approved;
  };
  return (
    <main className="shell">
      <a
        className="skip-link"
        href="#workspace-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('workspace-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <WorkspaceNavigation
        currentUser={currentUser}
        view={view}
        navigationOpen={navigationOpen}
        navigate={navigate}
        logout={logout}
        canLeave={canLeaveDatasetDraft}
      />
      <section id="workspace-content" className="content" tabIndex={-1}>
        <header className="topbar">
          <button
            type="button"
            className="secondary navigation-toggle"
            aria-controls="workspace-navigation"
            aria-expanded={navigationOpen}
            onClick={() => setNavigationOpen((open) => !open)}
          >
            {navigationOpen ? 'Close menu' : 'Menu'}
          </button>
          <div className="topbar-title">
            <SectionNavigation
              currentUser={currentUser}
              view={view}
              navigate={navigate}
              canLeave={canLeaveDatasetDraft}
            />
            <h1>{viewTitles[view]}</h1>
          </div>
          <div className="topbar-user" aria-label="Signed in user">
            <span className="topbar-user-avatar" aria-hidden="true">
              {currentUser?.name
                .split(' ')
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span>{currentUser?.name}</span>
          </div>
        </header>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {isAccountView(view) && currentUser && (
          <Accounts currentUser={currentUser} view={view} navigate={navigate} />
        )}
        {loading && (
          <div className="notice" role="status">
            Loading workspace data…
          </div>
        )}
        {view === 'archive' && currentUser?.role.code === 'ADMIN' && (
          <Archive />
        )}
        {(view === 'overview' || view === 'datasets') && currentUser && (
          <DatasetWorkspace
            campaigns={campaigns}
            currentUser={currentUser}
            onDraftChange={setDatasetDraftPending}
          />
        )}
        {view === 'analytics' && (
          <Analytics
            filters={workspaceFilters}
            campaigns={campaigns}
            channels={channels}
            result={dashboard}
            trends={trendQuery.data ?? null}
            from={from}
            to={to}
            setFrom={(value) => {
              setFrom(value);
              if (targetPeriod) setTargetPeriod('');
            }}
            setTo={(value) => {
              setTo(value);
              if (targetPeriod) setTargetPeriod('');
            }}
            setMetricFilter={setMetricFilter}
            setCampaignFilter={setCampaignFilter}
            setChannelFilter={(value) => {
              setChannelFilter(value);
              setPlatformFilter('');
              if (
                value &&
                metricFilter &&
                !dashboard?.metricMetadata
                  .find((metric) => metric.code === metricFilter)
                  ?.applicableChannelIds?.includes(value)
              )
                setMetricFilter('');
            }}
            setPlatformFilter={setPlatformFilter}
          />
        )}
        {view === 'targets' && currentUser && (
          <Targets
            currentUser={currentUser}
            channels={channels}
            campaigns={campaigns}
          />
        )}
        {view === 'campaigns' && (
          <Campaigns
            campaigns={campaigns}
            channels={channels}
            currentUser={currentUser}
            onCreated={(campaign) =>
              queryClient.setQueryData(
                ['workspace-context', currentUser!.id],
                (data: typeof workspaceQuery.data) =>
                  data && {
                    ...data,
                    campaigns: [
                      campaign,
                      ...data.campaigns.filter(
                        (item) => item.id !== campaign.id,
                      ),
                    ],
                  },
              )
            }
            onUpdated={(campaign) =>
              queryClient.setQueryData(
                ['workspace-context', currentUser!.id],
                (data: typeof workspaceQuery.data) =>
                  data && {
                    ...data,
                    campaigns: data.campaigns.map((item) =>
                      item.id === campaign.id ? campaign : item,
                    ),
                  },
              )
            }
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
            onDatasetDraftChange={setDatasetDraftPending}
            canLeaveDatasetDraft={canLeaveDatasetDraft}
            onArchived={(id) => {
              queryClient.setQueryData(
                ['workspace-context', currentUser!.id],
                (data: typeof workspaceQuery.data) =>
                  data && {
                    ...data,
                    campaigns: data.campaigns.filter((item) => item.id !== id),
                  },
              );
              setSelectedCampaignId(null);
            }}
          />
        )}
        {view === 'performance' && (
          <Performance
            records={records}
            campaigns={campaigns}
            currentUser={currentUser}
          />
        )}
        {view === 'reports' && <DatasetReports campaigns={campaigns} />}
        {view === 'integrations' && currentUser && (
          <Integrations
            currentUser={currentUser}
            channels={channels}
            campaigns={campaigns}
          />
        )}
        {view === 'users' && currentUser?.role.code === 'ADMIN' && (
          <>
            <AccessManagement
              onChanged={() => setUsersRevision((value) => value + 1)}
            />
            <Users key={usersRevision} />
          </>
        )}
        {view === 'profile' && currentUser && (
          <Profile currentUser={currentUser} />
        )}
        {view === 'settings' && currentUser?.role.code === 'ADMIN' && (
          <>
            <ReportingSettings />
            <CatalogueManagement
              channels={channels}
              onChanged={(next) =>
                queryClient.setQueryData(
                  ['workspace-context', currentUser!.id],
                  (data: typeof workspaceQuery.data) =>
                    data && { ...data, channels: next },
                )
              }
            />
          </>
        )}
      </section>
    </main>
  );
}
