'use client';

import { useMemo, useState } from 'react';
import { CampaignTable } from './campaign-table';
import { CampaignDetails } from './campaign-details';
import { CampaignForm } from './campaign-form';
import { Empty } from '../../components/empty';
import type { Campaign, Channel, CurrentUser } from '../../lib/workspace-types';

export function Campaigns({
  campaigns,
  channels,
  currentUser,
  onCreated,
  onUpdated,
  selectedCampaignId,
  onSelectCampaign,
  onDatasetDraftChange,
  canLeaveDatasetDraft,
  onArchived,
}: {
  campaigns: Campaign[];
  channels: Channel[];
  currentUser: CurrentUser | null;
  onCreated: (campaign: Campaign) => void;
  onUpdated: (campaign: Campaign) => void;
  selectedCampaignId: string | null;
  onSelectCampaign: (id: string | null) => void;
  onDatasetDraftChange?: (pending: boolean) => void;
  canLeaveDatasetDraft?: () => boolean;
  onArchived: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const canCreate =
    currentUser?.role.code === 'ADMIN' ||
    currentUser?.role.code === 'MARKETING_OFFICER';
  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        const query = search.trim().toLowerCase();
        const searchable = [
          campaign.name,
          ...(campaign.campaignChannels ?? []).map((item) => item.channel.name),
        ]
          .join(' ')
          .toLowerCase();
        return (
          (!query || searchable.includes(query)) &&
          (statusFilter === 'ALL' || campaign.status === statusFilter)
        );
      }),
    [campaigns, search, statusFilter],
  );
  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <div>
          <h2>Campaigns</h2>
          <p>Multi-channel campaign register.</p>
        </div>
        {canCreate && (
          <button
            className="primary"
            onClick={() => setShowForm((value) => !value)}
          >
            {showForm ? 'Close form' : '+ New campaign'}
          </button>
        )}
      </div>
      {showForm && canCreate && (
        <CampaignForm
          channels={channels}
          currentUser={currentUser}
          onCreated={(campaign) => {
            onCreated(campaign);
            setShowForm(false);
          }}
        />
      )}
      {campaigns.length ? (
        selectedCampaignId ? (
          <CampaignDetails
            campaign={
              campaigns.find((item) => item.id === selectedCampaignId) ?? null
            }
            canArchive={currentUser?.role.code === 'ADMIN'}
            canEdit={canCreate}
            currentUser={currentUser}
            onDatasetDraftChange={onDatasetDraftChange}
            canLeaveDatasetDraft={canLeaveDatasetDraft}
            onBack={() => {
              if (canLeaveDatasetDraft?.() ?? true) onSelectCampaign(null);
            }}
            onArchived={onArchived}
            onUpdated={onUpdated}
          />
        ) : (
          <>
            <div className="form-grid campaign-filters">
              <label>
                Search campaigns
                <input
                  aria-label="Search campaigns"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Campaign or channel"
                />
              </label>
              <label>
                Status
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="PLANNED">Planned</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="SUSPENDED">Suspended</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
            </div>
            {filteredCampaigns.length ? (
              <CampaignTable
                campaigns={filteredCampaigns}
                onSelect={onSelectCampaign}
              />
            ) : (
              <Empty
                title="No matching campaigns"
                detail="Adjust the search or status filter."
              />
            )}
          </>
        )
      ) : (
        <Empty
          title="No campaigns found"
          detail={
            canCreate
              ? 'Choose New campaign to create your first campaign.'
              : 'Campaigns will appear here when your marketing team creates them.'
          }
        />
      )}
    </section>
  );
}
