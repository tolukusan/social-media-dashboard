'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError, queryKeys } from '../../lib/api-client';
import type {
  Campaign,
  Channel,
  CurrentUser,
  KpiTarget,
  KpiTargetDefinition,
} from '../../lib/workspace-types';

type TargetForm = {
  kpiDefinitionId: string;
  periodType: string;
  targetValue: string;
  scopeType: 'GLOBAL' | 'CHANNEL' | 'PLATFORM' | 'CAMPAIGN';
  channelId: string;
  platformId: string;
  campaignId: string;
  comparisonRule: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  effectiveFrom: string;
  effectiveTo: string;
};

const emptyForm: TargetForm = {
  kpiDefinitionId: '',
  periodType: 'MONTHLY',
  targetValue: '',
  scopeType: 'GLOBAL',
  channelId: '',
  platformId: '',
  campaignId: '',
  comparisonRule: 'HIGHER_IS_BETTER',
  effectiveFrom: '',
  effectiveTo: '',
};

export function Targets({
  currentUser,
  channels,
  campaigns,
}: {
  currentUser: CurrentUser;
  channels: Channel[];
  campaigns: Campaign[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TargetForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const definitionsQuery = useQuery({
    queryKey: queryKeys.targetDefinitions,
    queryFn: () => apiRequest<KpiTargetDefinition[]>('/targets/definitions'),
  });
  const targetsQuery = useQuery({
    queryKey: queryKeys.targets,
    queryFn: () => apiRequest<KpiTarget[]>('/targets'),
  });
  const mutation = useMutation({
    mutationFn: async () => {
      const body = {
        kpiDefinitionId: form.kpiDefinitionId,
        periodType: form.periodType,
        targetValue: Number(form.targetValue),
        scopeType: form.scopeType,
        ...(form.scopeType === 'CHANNEL' && form.channelId
          ? { channelId: form.channelId }
          : {}),
        ...(form.scopeType === 'PLATFORM' && form.platformId
          ? { platformId: form.platformId }
          : {}),
        ...(form.scopeType === 'CAMPAIGN' && form.campaignId
          ? { campaignId: form.campaignId }
          : {}),
        comparisonRule: form.comparisonRule,
        effectiveFrom: form.effectiveFrom,
        ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
      };
      if (editing)
        return apiRequest<KpiTarget>(`/targets/${editing}`, {
          method: 'PATCH',
          body: {
            targetValue: body.targetValue,
            comparisonRule: body.comparisonRule,
            ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
          },
        });
      return apiRequest<KpiTarget>('/targets', { method: 'POST', body });
    },
    onSuccess: async () => {
      setError('');
      setForm(emptyForm);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.targets });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (cause: unknown) =>
      setError(
        cause instanceof ApiError || cause instanceof Error
          ? cause.message
          : 'The target could not be saved.',
      ),
  });
  const editable = currentUser.role.code === 'ADMIN';
  const platforms = channels.flatMap((channel) => channel.platforms);
  const targets = targetsQuery.data ?? [];

  return (
    <div className="page-stack">
      <section className="panel page-panel">
        <div className="panel-heading">
          <div>
            <h2>KPI targets</h2>
            <p>
              Targets use approved KPI definitions, periods, scopes, and
              comparison rules.
            </p>
          </div>
        </div>
        {definitionsQuery.isPending || targetsQuery.isPending ? (
          <div role="status">Loading targets…</div>
        ) : definitionsQuery.error || targetsQuery.error ? (
          <div className="notice error" role="alert">
            Could not load KPI targets. Refresh the page to retry.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">KPI</th>
                  <th scope="col">Target</th>
                  <th scope="col">Period</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Effective</th>
                  {editable && <th scope="col">Action</th>}
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => (
                  <tr key={target.id}>
                    <th scope="row">{target.kpiDefinition.name}</th>
                    <td>
                      {target.targetValue} ·{' '}
                      {target.comparisonRule.replaceAll('_', ' ').toLowerCase()}
                    </td>
                    <td>{target.periodType}</td>
                    <td>
                      {target.scopeType === 'CHANNEL'
                        ? target.channel?.name
                        : target.scopeType === 'PLATFORM'
                          ? target.platform?.name
                          : target.scopeType === 'CAMPAIGN'
                            ? target.campaign?.name
                            : 'All'}
                    </td>
                    <td>
                      {target.effectiveFrom.slice(0, 10)} –{' '}
                      {target.effectiveTo?.slice(0, 10) ?? 'open'}
                    </td>
                    {editable && (
                      <td>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setEditing(target.id);
                            setForm({
                              ...emptyForm,
                              kpiDefinitionId: target.kpiDefinitionId,
                              periodType: target.periodType,
                              targetValue: String(target.targetValue),
                              scopeType: target.scopeType,
                              channelId: target.channelId ?? '',
                              platformId: target.platformId ?? '',
                              campaignId: target.campaignId ?? '',
                              comparisonRule: target.comparisonRule,
                              effectiveFrom: target.effectiveFrom.slice(0, 10),
                              effectiveTo:
                                target.effectiveTo?.slice(0, 10) ?? '',
                            });
                          }}
                        >
                          Edit/end date
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {!targets.length && (
                  <tr>
                    <td colSpan={editable ? 6 : 5}>
                      No KPI targets have been configured.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editable && (
        <section className="panel page-panel">
          <h2>{editing ? 'Update or end target' : 'Create KPI target'}</h2>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="form-grid">
            <label>
              KPI definition
              <select
                aria-label="KPI definition"
                value={form.kpiDefinitionId}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm({ ...form, kpiDefinitionId: event.target.value })
                }
              >
                <option value="">Select a KPI</option>
                {(definitionsQuery.data ?? []).map((definition) => (
                  <option key={definition.id} value={definition.id}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Period
              <select
                aria-label="Target period"
                value={form.periodType}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm({ ...form, periodType: event.target.value })
                }
              >
                {[
                  'DAILY',
                  'WEEKLY',
                  'MONTHLY',
                  'QUARTERLY',
                  'YEARLY',
                  'CAMPAIGN',
                ].map((period) => (
                  <option key={period} value={period}>
                    {period}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Target value
              <input
                aria-label="Target value"
                type="number"
                min="0"
                step="any"
                value={form.targetValue}
                onChange={(event) =>
                  setForm({ ...form, targetValue: event.target.value })
                }
              />
            </label>
            <label>
              Comparison rule
              <select
                aria-label="Comparison rule"
                value={form.comparisonRule}
                onChange={(event) =>
                  setForm({
                    ...form,
                    comparisonRule: event.target
                      .value as TargetForm['comparisonRule'],
                  })
                }
              >
                <option value="HIGHER_IS_BETTER">Higher is better</option>
                <option value="LOWER_IS_BETTER">Lower is better</option>
              </select>
            </label>
            <label>
              Scope
              <select
                aria-label="Target scope"
                value={form.scopeType}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm({
                    ...form,
                    scopeType: event.target.value as TargetForm['scopeType'],
                  })
                }
              >
                {['GLOBAL', 'CHANNEL', 'PLATFORM', 'CAMPAIGN'].map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </label>
            {form.scopeType === 'CHANNEL' && (
              <label>
                Channel
                <select
                  aria-label="Target channel"
                  value={form.channelId}
                  disabled={Boolean(editing)}
                  onChange={(event) =>
                    setForm({ ...form, channelId: event.target.value })
                  }
                >
                  <option value="">Select a channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.scopeType === 'PLATFORM' && (
              <label>
                Platform
                <select
                  aria-label="Target platform"
                  value={form.platformId}
                  disabled={Boolean(editing)}
                  onChange={(event) =>
                    setForm({ ...form, platformId: event.target.value })
                  }
                >
                  <option value="">Select a platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.scopeType === 'CAMPAIGN' && (
              <label>
                Campaign
                <select
                  aria-label="Target campaign"
                  value={form.campaignId}
                  disabled={Boolean(editing)}
                  onChange={(event) =>
                    setForm({ ...form, campaignId: event.target.value })
                  }
                >
                  <option value="">Select a campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Effective from
              <input
                aria-label="Target effective from"
                type="date"
                disabled={Boolean(editing)}
                value={form.effectiveFrom}
                onChange={(event) =>
                  setForm({ ...form, effectiveFrom: event.target.value })
                }
              />
            </label>
            <label>
              Effective to (optional)
              <input
                aria-label="Target effective to"
                type="date"
                value={form.effectiveTo}
                onChange={(event) =>
                  setForm({ ...form, effectiveTo: event.target.value })
                }
              />
            </label>
          </div>
          <div className="form-actions">
            <button
              className="primary"
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? 'Saving…'
                : editing
                  ? 'Save target'
                  : 'Create target'}
            </button>
            {editing && (
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setEditing(null);
                  setForm(emptyForm);
                  setError('');
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </section>
      )}
      {!editable && (
        <p className="muted">Targets are read-only for your role.</p>
      )}
    </div>
  );
}
