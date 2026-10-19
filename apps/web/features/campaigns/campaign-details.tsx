'use client';

import { useState } from 'react';
import type {
  Campaign,
  CurrentUser,
  DatasetCampaignResult,
} from '../../lib/workspace-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';
import { CampaignEditForm } from './campaign-edit-form';
import { DatasetWorkspace } from '../datasets/dataset-workspace';
import { DatasetJoinByDate } from '../datasets/dataset-join-by-date';

export function CampaignDetails({
  campaign,
  canArchive,
  canEdit,
  currentUser,
  onDatasetDraftChange,
  canLeaveDatasetDraft = () => true,
  onBack,
  onArchived,
  onUpdated,
}: {
  campaign: Campaign | null;
  canArchive: boolean;
  canEdit: boolean;
  currentUser: CurrentUser | null;
  onDatasetDraftChange?: (pending: boolean) => void;
  canLeaveDatasetDraft?: () => boolean;
  onBack: () => void;
  onArchived: (id: string) => void;
  onUpdated: (campaign: Campaign) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDatasetWorkspace, setShowDatasetWorkspace] = useState(false);
  const campaignData = useQuery({
    queryKey: ['datasets', 'campaign', campaign?.id],
    enabled: Boolean(campaign && currentUser),
    queryFn: () =>
      apiRequest<DatasetCampaignResult>(`/datasets/campaigns/${campaign!.id}`),
  });
  if (!campaign)
    return (
      <div className="notice error" role="alert">
        Campaign details are unavailable. Return to the campaign list.
      </div>
    );
  const archive = async () => {
    if (!canLeaveDatasetDraft()) return;
    if (
      !window.confirm(
        `Archive “${campaign.name}”? Historical performance data will be preserved.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/campaigns/${campaign.id}`, { method: 'DELETE' });
      await invalidateWorkspace(queryClient);
      onArchived(campaign.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Campaign could not be archived.',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="detail-card">
      <button className="secondary" onClick={onBack}>
        ← Back to campaigns
      </button>
      <div className="panel-heading detail-heading">
        <div>
          <p className="eyebrow">Campaign details</p>
          <h3>{campaign.name}</h3>
        </div>
        <span className="status">{campaign.status}</span>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {editing && canEdit ? (
        <CampaignEditForm
          campaign={campaign}
          onSaved={(updated) => {
            onUpdated(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : null}
      {currentUser && !showDatasetWorkspace ? (
        campaignData.isPending ? (
          <p role="status">Loading campaign data…</p>
        ) : campaignData.error ? (
          <p className="notice error" role="alert">
            {campaignData.error.message}
          </p>
        ) : campaignData.data?.datasets.length ? (
          <DatasetJoinByDate
            key={campaign.id}
            datasets={campaignData.data.datasets}
            defaultOpen
          />
        ) : (
          <p className="notice">
            No imported data yet. Choose Manage campaign files to upload a file.
          </p>
        )
      ) : null}
      <dl className="detail-grid">
        <div>
          <dt>Start date</dt>
          <dd>{campaign.startDate.slice(0, 10)}</dd>
        </div>
        <div>
          <dt>End date</dt>
          <dd>{campaign.endDate?.slice(0, 10) || 'Open'}</dd>
        </div>
      </dl>
      <p className="muted-text">
        Performance records remain preserved when a campaign is archived.
      </p>
      {canEdit && !editing && (
        <button className="secondary" onClick={() => setEditing(true)}>
          Edit campaign
        </button>
      )}
      {canArchive && (
        <button
          className="secondary danger"
          disabled={busy}
          onClick={() => void archive()}
        >
          {busy ? 'Archiving…' : 'Archive campaign'}
        </button>
      )}
      {currentUser ? (
        <section className="campaign-data-section">
          <button
            type="button"
            className="secondary"
            aria-expanded={showDatasetWorkspace}
            onClick={() => {
              if (showDatasetWorkspace && !canLeaveDatasetDraft()) return;
              setShowDatasetWorkspace((visible) => !visible);
            }}
          >
            {showDatasetWorkspace
              ? 'Back to campaign data'
              : 'Manage campaign files'}
          </button>
          {showDatasetWorkspace ? (
            <DatasetWorkspace
              campaigns={[campaign]}
              currentUser={currentUser}
              campaignId={campaign.id}
              onDraftChange={onDatasetDraftChange}
            />
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
