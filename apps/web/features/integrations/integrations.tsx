'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';
import type { Campaign, Channel, CurrentUser } from '../../lib/workspace-types';

const labels: Record<string, string> = {
  FACEBOOK_ADS: 'Facebook Ads',
  INSTAGRAM_ADS: 'Instagram Ads',
  LINKEDIN_ADS: 'LinkedIn Ads',
  ZOHO_CAMPAIGNS: 'Zoho Campaigns',
};
const tokenReferences: Record<string, string> = {
  FACEBOOK_ADS: 'INTEGRATION_META_ACCESS_TOKEN',
  INSTAGRAM_ADS: 'INTEGRATION_META_ACCESS_TOKEN',
  LINKEDIN_ADS: 'INTEGRATION_LINKEDIN_ACCESS_TOKEN',
  ZOHO_CAMPAIGNS: 'INTEGRATION_ZOHO_ACCESS_TOKEN',
};
const statusLabels: Record<string, string> = {
  RUNNING: 'Syncing',
  SUCCEEDED: 'Completed',
  PARTIAL: 'Needs review',
  FAILED: 'Failed',
  BLOCKED: 'Awaiting configuration',
};
const errorLabels: Record<string, string> = {
  CREDENTIALS_REQUIRED: 'Awaiting server access token',
  REAUTHORIZATION_REQUIRED: 'Reconnect this provider account',
  API_VERSION_REQUIRED: 'Awaiting API version',
  CAMPAIGN_MAPPING_REQUIRED: 'Map an external campaign first',
  TOKEN_EXPIRED: 'Access token expired; ask your Administrator to replace it',
  SOURCE_TIMEZONE_MISMATCH:
    'Source and reporting timezones differ; daily totals cannot be shifted accurately',
  REPORTING_CURRENCY_MISMATCH:
    'Choose the advertising account currency in Settings',
  PROVIDER_CURRENCY_MISMATCH:
    'The provider currency differs from this connection',
  INTEGRATION_AUTHORITY_INACTIVE:
    'An active Administrator must configure this connection',
  PROVIDER_ACCESS_DENIED:
    'The provider denied access; check account permissions',
  PROVIDER_RATE_LIMITED: 'Provider rate limit reached; retry later',
  CONNECTION_DISCONNECTED: 'Connection disconnected',
  SYNC_INTERRUPTED: 'Previous sync interrupted; retry is safe',
};
type Run = {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  startedAt: string;
  triggeredBy: string;
  createdRecords: number;
  updatedRecords: number;
  unchangedRecords: number;
  conflicts: number;
  errorCode: string | null;
  summary?: {
    outcomes?: Array<{
      mappingId: string;
      errorCode?: string;
      snapshot?: {
        scope: string;
        externalCampaignId: string;
        values: Record<string, number>;
      };
    }>;
  };
};
type Connection = {
  id: string;
  provider: string;
  platformId: string;
  displayName: string;
  externalAccountId: string;
  sourceTimezone: string;
  credentialReference: string;
  credentialMode: 'SERVER_ENVIRONMENT' | 'OAUTH';
  oauthCredential: null | {
    status: 'CONNECTED' | 'REAUTH_REQUIRED';
    tokenExpiresAt: string | null;
    connectedAt: string;
    lastRefreshedAt: string | null;
    lastErrorCode: string | null;
    grantedScopes: string;
  };
  currency: string | null;
  active: boolean;
  autoSync: boolean;
  nextSyncAt: string;
  configuration: { ready: boolean; code: string | null };
  mappings: Array<{
    id: string;
    externalCampaignId: string;
    campaignPlatformId: string;
    campaignPlatform: { campaignChannel: { campaign: { name: string } } };
  }>;
  runs: Run[];
};
type CreateValues = {
  provider: string;
  platformId: string;
  displayName: string;
  externalAccountId: string;
  credentialReference: string;
  sourceTimezone: string;
  currency: string;
  region: string;
};
type Options = {
  providers: string[];
  regions: string[];
  reportingTimezone: string;
};

export function Integrations({
  currentUser,
  channels,
  campaigns,
}: {
  currentUser: CurrentUser;
  channels: Channel[];
  campaigns: Campaign[];
}) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const admin = currentUser.role.code === 'ADMIN';
  useEffect(() => {
    const url = new URL(window.location.href);
    const oauth = url.searchParams.get('oauth');
    if (!oauth) return;
    if (oauth === 'connected') setMessage('Provider authorization connected.');
    else if (oauth === 'denied')
      setError('Provider authorization was cancelled.');
    else setError('Provider authorization could not be completed. Try again.');
    url.searchParams.delete('oauth');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  const canSync = admin || currentUser.role.code === 'MARKETING_OFFICER';
  const connections = useQuery({
    queryKey: ['integrations', currentUser.id],
    queryFn: () => apiRequest<Connection[]>('/integrations'),
    refetchInterval: 30_000,
  });
  const setup = useQuery({
    queryKey: ['integration-options', currentUser.id],
    queryFn: async () => {
      const [options, settings] = await Promise.all([
        apiRequest<Options>('/integrations/options'),
        apiRequest<{
          reportingCurrency: string | null;
          availableCurrencies: string[];
        }>('/settings/reporting'),
      ]);
      return { ...options, ...settings };
    },
  });
  const history = useQuery({
    queryKey: ['integration-runs', currentUser.id, selectedId],
    enabled: Boolean(selectedId),
    queryFn: () => apiRequest<Run[]>(`/integrations/${selectedId}/runs`),
    refetchInterval: 15_000,
  });
  const form = useForm<CreateValues>({
    defaultValues: {
      provider: 'FACEBOOK_ADS',
      platformId: '',
      displayName: '',
      externalAccountId: '',
      credentialReference: tokenReferences.FACEBOOK_ADS,
      sourceTimezone: '',
      currency: '',
      region: 'US',
    },
  });
  const mapping = useForm<{
    campaignPlatformId: string;
    externalCampaignId: string;
  }>();
  const syncForm = useForm<{ from: string; to: string }>();
  const provider = form.watch('provider');
  const eligiblePlatforms = channels
    .filter(
      (channel) =>
        channel.active !== false &&
        channel.code ===
          (provider === 'ZOHO_CAMPAIGNS' ? 'EMAIL' : 'ADVERTISING'),
    )
    .flatMap((channel) =>
      channel.platforms.filter((platform) => platform.active !== false),
    );
  const selected = connections.data?.find(
    (connection) => connection.id === selectedId,
  );
  const contexts = campaigns
    .filter((campaign) => !campaign.archivedAt)
    .flatMap((campaign) =>
      (campaign.campaignChannels ?? []).flatMap((channel) =>
        (channel.campaignPlatforms ?? [])
          .filter(
            (context) =>
              context.id && context.platform.id === selected?.platformId,
          )
          .map((context) => ({
            id: context.id!,
            name: `${campaign.name} / ${context.platform.name}`,
          })),
      ),
    );

  async function action(
    work: () => Promise<unknown>,
    success: string,
    refreshAnalytics = false,
  ) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['integrations', currentUser.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ['integration-runs', currentUser.id],
        }),
      ]);
      setMessage(success);
      // Account setup changes no analytics. A completed import refreshes results
      // in the background without delaying the integration's own confirmation.
      if (refreshAnalytics) void invalidateWorkspace(queryClient);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not complete the integration action.',
      );
    } finally {
      setBusy(false);
    }
  }
  const create = form.handleSubmit((values) =>
    action(async () => {
      const connection = await apiRequest<Connection>('/integrations', {
        method: 'POST',
        body: {
          ...values,
          sourceTimezone:
            values.sourceTimezone ||
            setup.data?.reportingTimezone ||
            'Africa/Lagos',
          ...(values.provider === 'ZOHO_CAMPAIGNS'
            ? { currency: undefined }
            : {
                currency:
                  values.currency || setup.data?.reportingCurrency || undefined,
              }),
        },
      });
      setSelectedId(connection.id);
      form.reset({ ...values, displayName: '', externalAccountId: '' });
    }, 'Connection saved. Add campaign mappings; server credentials can be configured later.'),
  );

  return (
    <>
      <section className="panel page-panel">
        <div className="panel-heading">
          <div>
            <h2>Automatic imports</h2>
            <p>
              Connect campaign performance from Facebook Ads, Instagram Ads,
              LinkedIn Ads, and Zoho Campaigns. You can save setup before API
              credentials are ready.
            </p>
          </div>
        </div>
        <p>
          Advertising imports use completed daily observations. Zoho reports
          appear as cumulative campaign snapshots and are excluded from daily
          analytics.
        </p>
        <p>
          Administrators configure connections and schedules. Marketing Officers
          can sync configured connections. Additional providers require a
          supported connector.
        </p>
        {(error || connections.error || setup.error || history.error) && (
          <div className="notice error" role="alert">
            {error ||
              connections.error?.message ||
              setup.error?.message ||
              history.error?.message}
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        {connections.isPending && <p role="status">Loading integrations…</p>}
        {connections.data?.length === 0 && (
          <p>
            No connections yet. An Administrator can add the first connection.
          </p>
        )}
        <div className="integration-list">
          {connections.data?.map((connection) => (
            <article className="panel integration-card" key={connection.id}>
              <h3>{connection.displayName}</h3>
              <p>
                {labels[connection.provider]} · {connection.externalAccountId}
              </p>
              <p>
                {!connection.active
                  ? 'Disconnected'
                  : connection.credentialMode === 'OAUTH'
                    ? connection.oauthCredential?.status === 'CONNECTED'
                      ? 'Provider account authorized'
                      : 'Provider authorization required'
                    : connection.configuration.ready
                      ? 'Server credentials configured'
                      : (errorLabels[connection.configuration.code!] ??
                        'Awaiting server configuration')}{' '}
                · {connection.mappings.length} campaign mappings
              </p>
              <p>
                {connection.autoSync && connection.active
                  ? `Daily sync enabled. Next attempt: ${new Date(connection.nextSyncAt).toLocaleString()}`
                  : 'Daily sync off'}
              </p>
              {connection.runs[0] && (
                <p>
                  Last run: {statusLabels[connection.runs[0].status]} ·{' '}
                  {new Date(connection.runs[0].startedAt).toLocaleString()}
                </p>
              )}
              <button
                className="secondary"
                aria-pressed={selectedId === connection.id}
                onClick={() => {
                  setSelectedId(connection.id);
                  setError('');
                  setMessage('');
                  mapping.reset();
                  syncForm.reset();
                }}
              >
                View {connection.displayName}
              </button>
            </article>
          ))}
        </div>
      </section>
      {admin && (
        <section className="panel page-panel">
          <h2>Add connection</h2>
          <form className="form-grid" onSubmit={create}>
            <label>
              Provider
              <select
                {...form.register('provider', {
                  required: true,
                  onChange: (event) => {
                    const next = event.target.value as string;
                    form.setValue('platformId', '');
                    form.setValue('credentialReference', tokenReferences[next]);
                    form.setValue(
                      'sourceTimezone',
                      next === 'LINKEDIN_ADS'
                        ? 'UTC'
                        : (setup.data?.reportingTimezone ?? 'Africa/Lagos'),
                    );
                  },
                })}
              >
                {Object.entries(labels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Integration platform
              <select
                {...form.register('platformId', { required: true })}
                required
              >
                <option value="">Choose a platform</option>
                {eligiblePlatforms.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </label>
            {!eligiblePlatforms.length && (
              <p>
                Add a compatible{' '}
                {provider === 'ZOHO_CAMPAIGNS'
                  ? 'Email Marketing'
                  : 'Online Advertising'}{' '}
                platform in Settings first.
              </p>
            )}
            <label>
              Connection name
              <input
                {...form.register('displayName', { required: true })}
                required
                maxLength={120}
              />
            </label>
            <label>
              External account ID
              <input
                {...form.register('externalAccountId', { required: true })}
                required
                maxLength={160}
                pattern={
                  provider === 'ZOHO_CAMPAIGNS' ? '[A-Za-z0-9_-]+' : '[0-9]+'
                }
              />
            </label>
            <label>
              Source timezone
              <input
                {...form.register('sourceTimezone')}
                placeholder={setup.data?.reportingTimezone ?? 'Africa/Lagos'}
                maxLength={100}
              />
            </label>
            {provider !== 'ZOHO_CAMPAIGNS' && (
              <label>
                Account currency
                <select {...form.register('currency')} required defaultValue="">
                  <option value="">Choose the account currency</option>
                  {setup.data?.availableCurrencies.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {provider === 'ZOHO_CAMPAIGNS' && (
              <label>
                Zoho data region
                <select {...form.register('region')}>
                  {(setup.data?.regions ?? ['US']).map((region) => (
                    <option key={region}>{region}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Server token reference
              <input
                {...form.register('credentialReference', { required: true })}
                required
                maxLength={100}
                pattern="INTEGRATION_[A-Z0-9_]+_ACCESS_TOKEN"
                aria-describedby="token-reference-help"
              />
            </label>
            <p id="token-reference-help">
              This is a configuration name for legacy server tokens, not the
              token itself. After saving, you can authorize through the
              provider; never paste a token into this form.
            </p>
            <button
              className="primary"
              disabled={busy || !eligiblePlatforms.length}
            >
              Save connection
            </button>
          </form>
        </section>
      )}
      {selected && (
        <section className="panel page-panel">
          <h2>{selected.displayName}: campaigns and sync</h2>
          {admin && (
            <div className="home-actions">
              <p>
                {selected.oauthCredential?.status === 'CONNECTED'
                  ? 'OAuth authorization is stored encrypted on the API server.'
                  : selected.oauthCredential?.status === 'REAUTH_REQUIRED'
                    ? 'Provider authorization expired or was revoked. Reconnect to continue syncing.'
                    : 'Authorize this provider account. The browser will open the provider sign-in page.'}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const result = await apiRequest<{
                      authorizationUrl: string;
                    }>(`/integrations/${selected.id}/oauth/start`, {
                      method: 'POST',
                    });
                    const authorizationUrl = new URL(result.authorizationUrl);
                    const allowedHost =
                      authorizationUrl.protocol === 'https:' &&
                      ([
                        'www.facebook.com',
                        'www.linkedin.com',
                        'accounts.google.com',
                      ].includes(authorizationUrl.hostname) ||
                        /^accounts\.zoho\.(com|eu|in|com\.au|jp|com\.cn)$/.test(
                          authorizationUrl.hostname,
                        ));
                    if (!allowedHost)
                      throw new Error(
                        'The provider authorization URL is invalid.',
                      );
                    window.location.assign(authorizationUrl.toString());
                  }, 'Opening provider authorization…')
                }
              >
                {selected.oauthCredential?.status === 'CONNECTED'
                  ? 'Reconnect provider account'
                  : 'Connect with provider'}
              </button>
            </div>
          )}
          {admin && (
            <ConnectionConfiguration
              key={selected.id}
              connection={selected}
              currencies={setup.data?.availableCurrencies ?? []}
              busy={busy}
              onSave={(values) =>
                action(
                  () =>
                    apiRequest(`/integrations/${selected.id}`, {
                      method: 'PATCH',
                      body: values,
                    }),
                  'Server configuration reference saved.',
                )
              }
            />
          )}
          {selected.mappings.length ? (
            <ul>
              {selected.mappings.map((item) => (
                <li key={item.id}>
                  {item.campaignPlatform.campaignChannel.campaign.name} —
                  external campaign {item.externalCampaignId}
                </li>
              ))}
            </ul>
          ) : (
            <p>No campaign mappings yet.</p>
          )}
          {admin && selected.active && (
            <form
              className="form-grid"
              onSubmit={mapping.handleSubmit((values) =>
                action(async () => {
                  await apiRequest(`/integrations/${selected.id}/mappings`, {
                    method: 'POST',
                    body: values,
                  });
                  mapping.reset();
                }, 'Campaign mapped.'),
              )}
            >
              <label>
                Local campaign platform
                <select
                  {...mapping.register('campaignPlatformId', {
                    required: true,
                  })}
                  required
                >
                  <option value="">Choose a campaign</option>
                  {contexts.map((context) => (
                    <option key={context.id} value={context.id}>
                      {context.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                External campaign ID
                <input
                  {...mapping.register('externalCampaignId', {
                    required: true,
                  })}
                  maxLength={160}
                  required
                />
              </label>
              <p>
                Map each external campaign once. Existing manual or file data
                will be retained as conflicts.
              </p>
              <button className="secondary" disabled={busy || !contexts.length}>
                Map campaign
              </button>
            </form>
          )}
          {canSync && selected.active && (
            <form
              className="form-grid"
              onSubmit={syncForm.handleSubmit((values) =>
                action(
                  async () => {
                    const result = await apiRequest<Run>(
                      `/integrations/${selected.id}/sync`,
                      { method: 'POST', body: values },
                    );
                    if (result.errorCode)
                      throw new Error(
                        errorLabels[result.errorCode] ??
                          `Sync needs attention (${result.errorCode}). Check run history.`,
                      );
                  },
                  'Sync finished. Review imported records, conflicts, or campaign snapshots below.',
                  true,
                ),
              )}
            >
              <label>
                Sync from
                <input
                  type="date"
                  {...syncForm.register('from', { required: true })}
                  required
                />
              </label>
              <label>
                Sync to
                <input
                  type="date"
                  {...syncForm.register('to', { required: true })}
                  required
                />
              </label>
              <p>
                Choose up to 31 completed days in the source timezone. Empty
                provider responses remain missing data.
              </p>
              <button
                className="primary"
                disabled={
                  busy ||
                  !selected.configuration.ready ||
                  !selected.mappings.length
                }
              >
                Sync now
              </button>
            </form>
          )}
          {admin && (
            <div className="home-actions">
              <button
                className="secondary"
                disabled={busy || !selected.active}
                onClick={() =>
                  void action(
                    () =>
                      apiRequest(`/integrations/${selected.id}`, {
                        method: 'PATCH',
                        body: { autoSync: !selected.autoSync },
                      }),
                    selected.autoSync
                      ? 'Daily sync disabled.'
                      : 'Daily sync enabled. Missing server configuration will be reported in run history.',
                  )
                }
              >
                {selected.autoSync ? 'Disable daily sync' : 'Enable daily sync'}
              </button>
              {selected.active ? (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Disconnect ${selected.displayName}? Imported history will be retained.`,
                      )
                    )
                      void action(
                        () =>
                          apiRequest(
                            `/integrations/${selected.id}/disconnect`,
                            { method: 'POST' },
                          ),
                        'Disconnected locally and removed the saved OAuth token. The provider permission may still need to be revoked in its settings. Imported history is retained.',
                      );
                  }}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      () =>
                        apiRequest(`/integrations/${selected.id}`, {
                          method: 'PATCH',
                          body: { active: true },
                        }),
                      'Connection resumed.',
                    )
                  }
                >
                  Resume connection
                </button>
              )}
            </div>
          )}
          <h3>Run history</h3>
          {history.isPending ? (
            <p role="status">Loading run history…</p>
          ) : !history.data?.length ? (
            <p>No sync runs yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Status</th>
                    <th>Date range</th>
                    <th>Created / updated / unchanged</th>
                    <th>Conflicts</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((run) => (
                    <tr key={run.id}>
                      <td>
                        {new Date(run.startedAt).toLocaleString()}
                        <br />
                        {run.triggeredBy}
                      </td>
                      <td>{statusLabels[run.status]}</td>
                      <td>
                        {run.fromDate.slice(0, 10)} to {run.toDate.slice(0, 10)}
                      </td>
                      <td>
                        {run.createdRecords} / {run.updatedRecords} /{' '}
                        {run.unchangedRecords}
                      </td>
                      <td>{run.conflicts}</td>
                      <td>
                        {run.errorCode
                          ? (errorLabels[run.errorCode] ?? run.errorCode)
                          : run.status === 'PARTIAL'
                            ? 'Existing or archived data was retained. Review Performance data.'
                            : '—'}
                        {run.summary?.outcomes?.map((outcome) =>
                          outcome.snapshot ? (
                            <details key={outcome.mappingId}>
                              <summary>
                                Cumulative campaign snapshot:{' '}
                                {outcome.snapshot.externalCampaignId}
                              </summary>
                              <p>
                                Provider totals as observed at sync time;
                                excluded from daily analytics.
                              </p>
                              <dl>
                                {Object.entries(outcome.snapshot.values).map(
                                  ([code, value]) => (
                                    <div key={code}>
                                      <dt>
                                        {code
                                          .replaceAll('_', ' ')
                                          .toLowerCase()}
                                      </dt>
                                      <dd>{value.toLocaleString()}</dd>
                                    </div>
                                  ),
                                )}
                              </dl>
                            </details>
                          ) : outcome.errorCode ? (
                            <p key={outcome.mappingId}>
                              {errorLabels[outcome.errorCode] ??
                                outcome.errorCode}
                            </p>
                          ) : null,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ConnectionConfiguration({
  connection,
  currencies,
  busy,
  onSave,
}: {
  connection: Connection;
  currencies: string[];
  busy: boolean;
  onSave: (values: {
    credentialReference: string;
    sourceTimezone: string;
    currency?: string;
  }) => Promise<void>;
}) {
  const form = useForm<{
    credentialReference: string;
    sourceTimezone: string;
    currency: string;
  }>({
    defaultValues: {
      credentialReference: connection.credentialReference,
      sourceTimezone: connection.sourceTimezone,
      currency: connection.currency ?? '',
    },
  });
  return (
    <details>
      <summary>Server configuration</summary>
      <form
        className="form-grid"
        onSubmit={form.handleSubmit(({ currency, ...values }) =>
          onSave({
            ...values,
            ...(connection.provider !== 'ZOHO_CAMPAIGNS' ? { currency } : {}),
          }),
        )}
      >
        <label>
          Configured token reference
          <input
            {...form.register('credentialReference', { required: true })}
            required
            maxLength={100}
            pattern="INTEGRATION_[A-Z0-9_]+_ACCESS_TOKEN"
          />
        </label>
        <label>
          Configured source timezone
          <input
            {...form.register('sourceTimezone', { required: true })}
            required
            maxLength={100}
          />
        </label>
        {connection.provider !== 'ZOHO_CAMPAIGNS' && (
          <label>
            Configured account currency
            <select {...form.register('currency', { required: true })} required>
              {currencies.map((currency) => (
                <option key={currency}>{currency}</option>
              ))}
            </select>
          </label>
        )}
        <p>
          Store the token itself only on the API server. Currency and source
          timezone can be corrected before daily history is imported.
        </p>
        <button className="secondary" disabled={busy}>
          Save server configuration reference
        </button>
      </form>
    </details>
  );
}
