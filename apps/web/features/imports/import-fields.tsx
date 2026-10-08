'use client';
import type { Dispatch, SetStateAction } from 'react';
import {
  destinations,
  type Preview,
  type Campaign,
  type Platform,
} from './import-types';
type FieldsProps = {
  preview: Preview;
  displayName: string;
  setDisplayName: (value: string) => void;
  campaignId: string;
  setCampaignId: (value: string) => void;
  campaigns: Campaign[];
  campaignMappings: Record<string, string>;
  setCampaignMappings: Dispatch<SetStateAction<Record<string, string>>>;
  setCampaignToCreate: (value: string) => void;
  platformId: string;
  setPlatformId: (value: string) => void;
  platforms: Platform[];
  datasetAction: 'CREATE' | 'APPEND' | 'MERGE';
  setDatasetAction: (value: 'CREATE' | 'APPEND' | 'MERGE') => void;
  mapping: Record<string, string>;
  setMapping: Dispatch<SetStateAction<Record<string, string>>>;
  displayNames: Record<string, string>;
  setDisplayNames: Dispatch<SetStateAction<Record<string, string>>>;
  showIgnoredColumns: boolean;
  setShowIgnoredColumns: Dispatch<SetStateAction<boolean>>;
};
export function ImportFields({
  preview,
  displayName,
  setDisplayName,
  campaignId,
  setCampaignId,
  campaigns,
  campaignMappings,
  setCampaignMappings,
  setCampaignToCreate,
  platformId,
  setPlatformId,
  platforms,
  datasetAction,
  setDatasetAction,
  mapping,
  setMapping,
  displayNames,
  setDisplayNames,
  showIgnoredColumns,
  setShowIgnoredColumns,
}: FieldsProps) {
  return (
    <>
      <div className="form-grid import-context">
        <label>
          Dataset/import name
          <input
            value={displayName}
            maxLength={180}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </label>
        {preview.source.type === 'EMAIL' &&
        preview.campaignValues.length > 1 ? (
          <div className="import-field campaign-mappings">
            <strong>Detected campaigns</strong>
            {preview.campaignValues.map((campaignName) => (
              <div key={campaignName} className="import-field">
                <span>{campaignName}</span>
                <select
                  value={campaignMappings[campaignName] ?? ''}
                  onChange={(event) =>
                    setCampaignMappings({
                      ...campaignMappings,
                      [campaignName]: event.target.value,
                    })
                  }
                >
                  <option value="">Select existing campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setCampaignToCreate(campaignName)}
                >
                  + Create as new campaign
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="import-field">
            <label htmlFor="import-campaign">Campaign</label>
            <select
              id="import-campaign"
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
            >
              <option value="">Select existing campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            <button
              className="secondary"
              type="button"
              onClick={() => setCampaignToCreate('')}
            >
              + Create new campaign
            </button>
          </div>
        )}
        <label>
          Platform
          <select
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
          >
            <option value="">Select existing platform</option>
            {platforms
              .filter(
                (platform) =>
                  platform.active !== false &&
                  platform.channel?.active !== false,
              )
              .map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}{' '}
                  {platform.channel ? `(${platform.channel.name})` : ''}
                </option>
              ))}
          </select>
        </label>
        <label>
          Dataset action
          <select
            value={datasetAction}
            onChange={(event) =>
              setDatasetAction(
                event.target.value as 'CREATE' | 'APPEND' | 'MERGE',
              )
            }
          >
            <option value="CREATE">
              Start data for this campaign/platform
            </option>
            <option value="APPEND">Add new dates</option>
            <option value="MERGE">Add missing metrics to matching dates</option>
          </select>
        </label>
        {datasetAction === 'MERGE' && (
          <p className="field-help">
            Rows are matched by campaign, platform, and calendar record date.
          </p>
        )}
      </div>
      <div className="mapping-section">
        <h3>Analytics fields</h3>
        <div className="mapping-list">
          {preview.columns
            .filter((column) => mapping[column])
            .map((column) => (
              <label key={column} className="import-field">
                <span>{column}</span>
                <input
                  aria-label={`Display name for ${column}`}
                  value={displayNames[column] ?? column}
                  onChange={(event) =>
                    setDisplayNames({
                      ...displayNames,
                      [column]: event.target.value,
                    })
                  }
                />
                <select
                  value={mapping[column] ?? ''}
                  onChange={(event) =>
                    setMapping({
                      ...mapping,
                      [column]: event.target.value,
                    })
                  }
                >
                  <option value="">Ignore column</option>
                  {destinations.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
        <div className="mapping-section-heading">
          <h3>
            Source-only fields (
            {preview.columns.filter((column) => !mapping[column]).length})
          </h3>
          <button
            className="secondary"
            type="button"
            onClick={() => setShowIgnoredColumns((value) => !value)}
          >
            {showIgnoredColumns ? 'Hide' : 'Show'}
          </button>
        </div>
        {showIgnoredColumns && (
          <div className="mapping-list">
            {preview.columns
              .filter((column) => !mapping[column])
              .map((column) => (
                <label key={column} className="import-field">
                  <span>{column}</span>
                  <input
                    aria-label={`Display name for ${column}`}
                    value={displayNames[column] ?? column}
                    onChange={(event) =>
                      setDisplayNames({
                        ...displayNames,
                        [column]: event.target.value,
                      })
                    }
                  />
                  <select
                    value={mapping[column] ?? ''}
                    onChange={(event) =>
                      setMapping({
                        ...mapping,
                        [column]: event.target.value,
                      })
                    }
                  >
                    <option value="">Keep source-only</option>
                    {destinations.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
