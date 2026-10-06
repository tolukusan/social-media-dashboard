'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthLoading, Login } from '../features/auth/login';
import { Campaigns } from '../features/campaigns/campaigns';
import { Performance } from '../features/performance/performance';
import { Overview } from '../features/dashboard/overview';
import { Reports } from '../features/reports/reports';
import { CatalogueManagement } from '../features/catalogue/catalogue-management';
import { Users } from '../features/users/users';
import { Profile } from '../features/users/profile';
import { Targets } from '../features/targets/targets';
import { Analytics } from '../features/analytics/analytics';
import type {
  View,
  AuthStatus,
  DashboardResult,
  Campaign,
  Channel,
  PerformanceRecord,
  CurrentUser,
  TrendResult,
} from '../lib/workspace-types';
import { ApiError, apiRequest, queryKeys } from '../lib/api-client';

export function WorkspaceShell() {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery({
    queryKey: queryKeys.session,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      try {
        return await apiRequest<CurrentUser>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
  });
  const currentUser = sessionQuery.data ?? null;
  const authStatus: AuthStatus = sessionQuery.isPending
    ? 'checking'
    : currentUser
      ? 'authenticated'
      : 'unauthenticated';
  const [authError, setAuthError] = useState('');
  const identityRef = useRef<string | null>(null);
  const [view, setView] = useState<View>('overview');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [metricFilter, setMetricFilter] = useState('');
  const [targetPeriod, setTargetPeriod] = useState('');
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
    queryKey: currentUser
      ? queryKeys.workspace(currentUser.id, workspaceFilters)
      : ['workspace', 'anonymous'],
    enabled: authStatus === 'authenticated' && Boolean(currentUser),
    queryFn: async () => {
      const params = new URLSearchParams(
        Object.entries(workspaceFilters).filter(([, value]) => Boolean(value)),
      );
      try {
        const [dashboard, campaigns, records, channels] = await Promise.all([
          apiRequest<DashboardResult>(`/analytics/dashboard?${params}`),
          apiRequest<Campaign[]>('/campaigns'),
          apiRequest<PerformanceRecord[]>('/performance-records'),
          apiRequest<Channel[]>('/channels'),
        ]);
        return { dashboard, campaigns, records, channels };
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
  const trendQuery = useQuery({
    queryKey: ['trends', currentUser?.id ?? 'anonymous', workspaceFilters],
    enabled:
      authStatus === 'authenticated' && Boolean(currentUser && from && to),
    queryFn: async () => {
      const params = new URLSearchParams(
        Object.entries(workspaceFilters).filter(([, value]) => Boolean(value)),
      );
      return apiRequest<TrendResult>(`/analytics/trends?${params}`);
    },
  });
  const dashboard = workspaceQuery.data?.dashboard ?? null;
  const campaigns = workspaceQuery.data?.campaigns ?? [];
  const channels = workspaceQuery.data?.channels ?? [];
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const records = workspaceQuery.data?.records ?? [];
  const loading = workspaceQuery.isFetching;
  const error =
    workspaceQuery.error instanceof Error ? workspaceQuery.error.message : '';

  useEffect(() => {
    const nextId = currentUser?.id ?? null;
    if (identityRef.current && identityRef.current !== nextId) {
      queryClient.removeQueries({ queryKey: ['workspace'] });
      queryClient.removeQueries({ queryKey: ['report-preview'] });
      queryClient.removeQueries({ queryKey: ['imports'] });
      queryClient.removeQueries({ queryKey: ['users'] });
    }
    identityRef.current = nextId;
  }, [currentUser?.id, queryClient]);

  useEffect(() => {
    if (
      workspaceQuery.error instanceof ApiError &&
      workspaceQuery.error.status === 401
    ) {
      queryClient.clear();
      queryClient.setQueryData(queryKeys.session, null);
    }
  }, [workspaceQuery.error, queryClient]);

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

  const navigate = (next: View) => setView(next);
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">M</span>
          <span>Marketwise</span>
        </div>
        <nav aria-label="Primary navigation">
          <a href="/imports">Imports</a>
          {(
            [
              ['overview', 'Overview'],
              ['campaigns', 'Campaigns'],
              ['performance', 'Performance data'],
              ['analytics', 'Analytics'],
              ['targets', 'KPI targets'],
              ['reports', 'Reports'],
              ['profile', 'My profile'],
              ...(currentUser?.role.code === 'ADMIN'
                ? ([['settings', 'Settings']] as const)
                : []),
              ...(currentUser?.role.code === 'ADMIN'
                ? ([['users', 'Users']] as const)
                : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={view === id ? 'active' : ''}
              onClick={() => navigate(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="avatar">
            {currentUser?.name
              ?.split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)
              .toUpperCase() || 'U'}
          </span>
          <span>
            <strong>{currentUser?.name || 'Workspace user'}</strong>
            <small>{currentUser?.role.name || 'Authenticated user'}</small>
          </span>
          <button
            className="logout"
            onClick={() => {
              void logout().catch((cause: unknown) =>
                setAuthError(
                  cause instanceof Error ? cause.message : 'Could not log out.',
                ),
              );
            }}
          >
            Log out
          </button>
        </div>
      </aside>
      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Digital marketing performance</p>
            <h1>
              {view === 'overview'
                ? 'Overview'
                : view === 'performance'
                  ? 'Performance data'
                  : view === 'users'
                    ? 'Users'
                    : view === 'settings'
                      ? 'Settings'
                      : view[0].toUpperCase() + view.slice(1)}
            </h1>
          </div>
        </header>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {loading && (
          <div className="notice" role="status">
            Loading workspace data…
          </div>
        )}
        {view === 'overview' && (
          <Overview
            result={dashboard}
            campaigns={campaigns}
            setFrom={(value) => {
              setFrom(value);
              if (targetPeriod) setTargetPeriod('');
            }}
            setTo={(value) => {
              setTo(value);
              if (targetPeriod) setTargetPeriod('');
            }}
            navigate={navigate}
            analytics={false}
            channels={channels}
            filters={workspaceFilters}
            setCampaignFilter={(value) => {
              setCampaignFilter(value);
              if (!value && targetPeriod === 'CAMPAIGN') setTargetPeriod('');
            }}
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
            setMetricFilter={setMetricFilter}
            setTargetPeriod={(value) => {
              setTargetPeriod(value);
              if (value === 'CAMPAIGN') {
                setFrom('');
                setTo('');
              }
            }}
            trends={trendQuery.data ?? null}
            trendsLoading={trendQuery.isFetching}
            trendsError={
              trendQuery.error instanceof Error ? trendQuery.error.message : ''
            }
            retryTrends={() => void trendQuery.refetch()}
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
                queryKeys.workspace(currentUser!.id, workspaceFilters),
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
                queryKeys.workspace(currentUser!.id, workspaceFilters),
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
            onArchived={(id) => {
              queryClient.setQueryData(
                queryKeys.workspace(currentUser!.id, workspaceFilters),
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
        {view === 'reports' && <Reports filters={workspaceFilters} />}
        {view === 'users' && currentUser?.role.code === 'ADMIN' && <Users />}
        {view === 'profile' && currentUser && (
          <Profile currentUser={currentUser} />
        )}
        {view === 'settings' && currentUser?.role.code === 'ADMIN' && (
          <CatalogueManagement
            channels={channels}
            onChanged={(next) =>
              queryClient.setQueryData(
                queryKeys.workspace(currentUser!.id, workspaceFilters),
                (data: typeof workspaceQuery.data) =>
                  data && { ...data, channels: next },
              )
            }
          />
        )}
      </section>
    </main>
  );
}
