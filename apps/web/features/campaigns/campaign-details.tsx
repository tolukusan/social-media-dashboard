'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Campaign } from '../../lib/workspace-types';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';
import { CampaignEditForm } from './campaign-edit-form';

export function CampaignDetails({
  campaign,
  canArchive,
  canEdit,
  onBack,
  onArchived,
  onUpdated,
}: {
  campaign: Campaign | null;
  canArchive: boolean;
  canEdit: boolean;
  onBack: () => void;
  onArchived: (id: string) => void;
  onUpdated: (campaign: Campaign) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!campaign)
    return (
      <div className="notice error" role="alert">
        Campaign details are unavailable. Return to the campaign list.
      </div>
    );
  const archive = async () => {
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
      <dl className="detail-grid">
        <div>
          <dt>Start date</dt>
          <dd>{campaign.startDate.slice(0, 10)}</dd>
        </div>
        <div>
          <dt>End date</dt>
          <dd>{campaign.endDate?.slice(0, 10) || 'Open'}</dd>
        </div>
        <div>
          <dt>Channels</dt>
          <dd>
            {campaign.campaignChannels
              ?.map((item) => item.channel.name)
              .join(', ') || '—'}
          </dd>
        </div>
        <div>
          <dt>Platforms</dt>
          <dd>
            {campaign.campaignChannels
              ?.flatMap(
                (item) =>
                  item.campaignPlatforms?.map((link) => link.platform.name) ??
                  [],
              )
              .join(', ') || '—'}
          </dd>
        </div>
      </dl>
      <p className="muted-text">
        Performance records remain preserved when a campaign is archived.
      </p>
      {canEdit && !editing && (
        <Link
          className="primary download"
          href={`/imports?campaignId=${campaign.id}`}
        >
          Add data to this campaign
        </Link>
      )}
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
    </section>
  );
}
