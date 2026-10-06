'use client';

import type { Campaign } from '../../lib/workspace-types';

export function CampaignTable({
  campaigns,
  onSelect,
}: {
  campaigns: Campaign[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Campaign list</caption>
        <thead>
          <tr>
            <th scope="col">Campaign</th>
            <th scope="col">Status</th>
            <th scope="col">Channels</th>
            <th scope="col">Start</th>
            <th scope="col">End</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <tr key={campaign.id}>
              <th scope="row">
                {onSelect ? (
                  <button
                    className="text-link button-link"
                    onClick={() => onSelect(campaign.id)}
                  >
                    {campaign.name}
                  </button>
                ) : (
                  campaign.name
                )}
              </th>
              <td>
                <span className="status">{campaign.status}</span>
              </td>
              <td>
                {campaign.campaignChannels
                  ?.map((item) => item.channel.name)
                  .join(', ') || '—'}
              </td>
              <td>{campaign.startDate.slice(0, 10)}</td>
              <td>{campaign.endDate?.slice(0, 10) || 'Open'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
