'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  apiRequest,
  invalidateWorkspace,
  queryKeys,
} from '../../lib/api-client';
import { useSession } from '../auth/use-session';
import type { CurrentUser } from '../../lib/workspace-types';
import Link from 'next/link';

const destinations = [
  ['recordDate', 'Record date'],
  ['campaignName', 'Campaign name'],
  ['SM_REACH', 'Social reach'],
  ['SM_IMPRESSIONS', 'Social impressions'],
  ['SM_ENGAGEMENTS', 'Social engagements'],
  ['SM_LINK_CLICKS', 'Social link clicks'],
  ['SM_FOLLOWERS_GAINED', 'Followers gained'],
  ['SM_VIEWS', 'Social views'],
  ['SM_PROFILE_VISITS', 'Profile/page visits'],
  ['SM_VIEWERS', 'Unique viewers'],
  ['EMAIL_SENT', 'Emails sent'],
  ['EMAIL_DELIVERED', 'Emails delivered'],
  ['EMAIL_OPENS', 'Email opens'],
  ['EMAIL_CLICKS', 'Email clicks'],
  ['EMAIL_UNSUBSCRIBES', 'Unsubscribes'],
  ['EMAIL_BOUNCES', 'Bounces'],
  ['EMAIL_HARD_BOUNCES', 'Hard bounces'],
  ['EMAIL_SOFT_BOUNCES', 'Soft bounces'],
  ['EMAIL_SPAM_COMPLAINTS', 'Spam complaints'],
];

type Preview = {
  id: string;
  filename: string;
  format: string;
  checksum: string;
  displayName: string;
  duplicateCompleted: boolean;
  source: { type: string; platform: string | null };
  sheets: string[];
  columns: string[];
  rowCount: number;
  sampleRows: Array<{ sourceRowNumber: number; data: Record<string, unknown> }>;
  campaignValues: string[];
  matchingTemplate?: {
    displayName: string;
    mapping: Record<string, string>;
  };
  suggestedMapping: Record<string, string>;
  warnings: string[];
};
type Campaign = { id: string; name: string };
type Platform = {
  id: string;
  name: string;
  active?: boolean;
  channel?: { id: string; name: string; active?: boolean };
};
type Channel = {
  id: string;
  name: string;
  active?: boolean;
  platforms: Array<{ id: string; name: string; active?: boolean }>;
};
type HistoryItem = {
  id: string;
  displayName?: string | null;
  originalFilename: string;
  sourcePlatform?: string | null;
  status: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  createdAt: string;
  importedByUser?: { name: string };
};
type Result = {
  id: string;
  status: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  warningCount: number;
  rows: Array<{
    sourceRowNumber?: number;
    status: string;
    errors: Array<{ message: string }>;
    warnings: Array<{ message: string }>;
  }>;
};

function CreateImportCampaign({
  initialName,
  currentUser,
  channels,
  preferredPlatformId,
  onClose,
  onCreated,
}: {
  initialName: string;
  currentUser: CurrentUser | null;
  channels: Channel[];
  preferredPlatformId: string;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const queryClient = useQueryClient();
  const preferredChannel = channels.find((channel) =>
    channel.platforms.some((platform) => platform.id === preferredPlatformId),
  );
  const [name, setName] = useState(initialName);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [channelId, setChannelId] = useState(preferredChannel?.id ?? '');
  const [platformId, setPlatformId] = useState(preferredPlatformId);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selectedChannel = channels.find((channel) => channel.id === channelId);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        body: {
          name,
          startDate,
          endDate: endDate || undefined,
          responsibleUserId: currentUser?.id,
          channels: [{ channelId, platformIds: [platformId] }],
        },
      });
      await invalidateWorkspace(queryClient);
      onCreated(data);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Campaign could not be created.',
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-import-campaign"
      >
        <div className="panel-heading">
          <h2 id="create-import-campaign">Create campaign for this import</h2>
          <button className="secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <form className="form-grid" onSubmit={submit}>
          <label>
            Campaign name
            <input
              required
              minLength={2}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Start date
            <input
              required
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label>
            Channel
            <select
              required
              value={channelId}
              onChange={(event) => {
                setChannelId(event.target.value);
                setPlatformId('');
              }}
            >
              <option value="">Select channel</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Platform
            <select
              required
              value={platformId}
              onChange={(event) => setPlatformId(event.target.value)}
            >
              <option value="">Select platform</option>
              {selectedChannel?.platforms.map((platform) => (
                <option key={platform.id} value={platform.id}>
                  {platform.name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create and return to import'}
          </button>
        </form>
      </section>
    </div>
  );
}

function previewValue(value: unknown, destination?: string) {
  if (value === null || value === undefined) return '—';
  if (destination === 'recordDate' && typeof value === 'string') {
    const iso = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(value)?.[1];
    if (iso) return iso;
  }
  return String(value);
}

export function Imports() {
  const queryClient = useQueryClient();
  const sessionQuery = useSession();
  const currentUser = sessionQuery.data ?? null;
  const userId = currentUser?.id;
  const authenticated = sessionQuery.isPending ? null : Boolean(currentUser);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [campaignId, setCampaignId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [campaignMappings, setCampaignMappings] = useState<
    Record<string, string>
  >({});
  const [platformId, setPlatformId] = useState('');
  const [datasetAction, setDatasetAction] = useState<
    'CREATE' | 'APPEND' | 'MERGE'
  >('CREATE');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [campaignToCreate, setCampaignToCreate] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [validatedConfiguration, setValidatedConfiguration] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showIgnoredColumns, setShowIgnoredColumns] = useState(false);
  const [matchingTemplate, setMatchingTemplate] =
    useState<Preview['matchingTemplate']>();

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const load = async () => {
      try {
        const [nextCampaigns, nextPlatforms, nextChannels, nextHistory] =
          await Promise.all([
            apiRequest<Campaign[]>('/campaigns'),
            apiRequest<Platform[]>('/platforms'),
            apiRequest<Channel[]>('/channels'),
            apiRequest<HistoryItem[]>('/imports'),
          ]);
        if (!active) return;
        setCampaigns(nextCampaigns);
        setPlatforms(nextPlatforms);
        setChannels(nextChannels);
        setHistory(nextHistory);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) {
          await queryClient.cancelQueries({ queryKey: queryKeys.session });
          queryClient.removeQueries({
            predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
          });
          queryClient.setQueryData(queryKeys.session, null);
        } else {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Imports could not be loaded.',
          );
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [userId, queryClient]);

  const previewRows = useMemo(() => preview?.sampleRows ?? [], [preview]);
  const configuration = JSON.stringify({
    batchId: preview?.id,
    mapping,
    displayNames,
    displayName,
    campaignId,
    campaignMappings,
    datasetAction,
    platformId,
    selectedSheet,
  });
  const validationCurrent = validatedConfiguration === configuration;
  const hasCampaignContext =
    Boolean(campaignId) ||
    (preview?.campaignValues.length
      ? preview.campaignValues.every((value) =>
          Boolean(campaignMappings[value]),
        )
      : false);
  const canValidate = Boolean(
    preview &&
    platformId &&
    hasCampaignContext &&
    Object.values(mapping).includes('recordDate') &&
    displayName.trim(),
  );
  const upload = async () => {
    if (!file) return;
    if (!/\.(csv|json|xlsx)$/i.test(file.name)) {
      setError(
        file.name.toLowerCase().endsWith('.xls')
          ? 'This is an older Excel (.xls) file. Open it in Excel or LibreOffice and save a copy as .xlsx, then upload that copy. Renaming the extension does not convert the file.'
          : 'Choose a CSV, JSON, or XLSX file.',
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(
        'This file exceeds 10 MB. Export a smaller date range and try again.',
      );
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    setResult(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const data = await apiRequest<Preview>('/imports/preview', {
        method: 'POST',
        body,
      });
      setPreview(data);
      setDisplayName(data.displayName);
      setMapping(data.suggestedMapping);
      setDisplayNames(
        Object.fromEntries(data.columns.map((column) => [column, column])),
      );
      setMatchingTemplate(data.matchingTemplate);
      if (data.matchingTemplate)
        setMessage(
          `Previous mapping found from ${data.matchingTemplate.displayName}. Review it before validation.`,
        );
      setCampaignMappings(
        Object.fromEntries(data.campaignValues.map((value) => [value, ''])),
      );
      setSelectedSheet(data.sheets[0] ?? '');
      setMessage('File staged. Review mappings before validation.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The file could not be previewed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    if (!preview) return;
    setValidatedConfiguration(null);
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await apiRequest<Result>(`/imports/${preview.id}/map`, {
        method: 'POST',
        body: {
          mapping,
          columnDisplayNames: displayNames,
          displayName: displayName.trim() || undefined,
          campaignId:
            preview.source.type === 'EMAIL' && preview.campaignValues.length > 1
              ? undefined
              : campaignId || undefined,
          campaignMappings:
            preview.source.type === 'EMAIL' && preview.campaignValues.length > 0
              ? campaignMappings
              : undefined,
          datasetAction,
          platformId: platformId || undefined,
          selectedSheet: selectedSheet || undefined,
          sourcePlatform: preview.source.platform || undefined,
        },
      });
      setResult(data);
      setValidatedConfiguration(configuration);
      setMessage(
        data.status === 'READY'
          ? 'Validation completed. Review conflicts before confirming.'
          : 'No rows are ready for import.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (
      !preview ||
      !result ||
      result.status !== 'READY' ||
      !validationCurrent ||
      preview.duplicateCompleted
    )
      return;
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest<{ status?: string }>(
        `/imports/${preview.id}/confirm`,
        {
          method: 'POST',
        },
      );
      setMessage(
        'Import completed. Imported records are now available to analytics and reporting.',
      );
      setResult({ ...result, status: data.status ?? 'COMPLETED' });
      setHistory(await apiRequest<HistoryItem[]>('/imports'));
      await invalidateWorkspace(queryClient);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Import could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (authenticated === null)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Checking your session</h1>
        </section>
      </main>
    );
  if (!authenticated)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Sign in required</h1>
          <p className="auth-copy">
            Return to the workspace and sign in before importing data.
          </p>
          <Link className="primary download" href="/">
            Return to workspace
          </Link>
        </section>
      </main>
    );
  return (
    <main className="content import-page">
      <header className="topbar">
        <div>
          <p className="eyebrow">Structured data</p>
          <h1>Import performance data</h1>
        </div>
        <Link className="secondary" href="/">
          Back to workspace
        </Link>
      </header>
      <nav className="import-steps" aria-label="Import steps">
        <a href="#import-upload">1. Upload</a>
        {preview ? (
          <a href="#import-preview">2. Preview</a>
        ) : (
          <span>2. Preview</span>
        )}
        {preview ? (
          <a href="#import-mapping">3. Map and select context</a>
        ) : (
          <span>3. Map and select context</span>
        )}
        {result ? (
          <a href="#import-validation">4. Review and confirm</a>
        ) : (
          <span>4. Review and confirm</span>
        )}
      </nav>
      <section id="import-upload" className="panel page-panel">
        <h2>1. Upload</h2>
        <p>
          Supported formats: CSV, JSON, and XLSX, up to 10 MB. Files are staged
          before any analytical records are written.
        </p>
        <p>
          For older Excel (.xls) exports, save a copy as XLSX first. Keep your
          original file for reference.
        </p>
        <div className="import-upload">
          <input
            aria-label="Select import file"
            type="file"
            accept=".csv,.json,.xlsx"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFile(event.target.files?.[0] ?? null)
            }
          />
          <button
            className="primary"
            disabled={!file || busy}
            onClick={() => void upload()}
          >
            {busy && !preview ? 'Staging…' : 'Upload and preview'}
          </button>
        </div>
      </section>
      {preview && (
        <>
          <section id="import-preview" className="panel page-panel">
            <div className="panel-heading">
              <div>
                <h2>2. Preview</h2>
                <p>
                  {preview.filename} · {preview.rowCount} rows ·{' '}
                  {preview.format}
                </p>
              </div>
              <span className="status">{preview.source.type}</span>
            </div>
            {preview.duplicateCompleted && (
              <div className="notice error">
                This exact file was already completed. Confirmation is blocked.
              </div>
            )}
            {preview.warnings.map((warning) => (
              <div className="notice" key={warning}>
                {warning}
              </div>
            ))}
            <div className="table-wrap import-table">
              <table>
                <caption className="sr-only">Import sample rows</caption>
                <thead>
                  <tr>
                    <th>Row</th>
                    {preview.columns.map((column) => (
                      <th key={column}>{displayNames[column] || column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={`${row.sourceRowNumber}`}>
                      <th>{row.sourceRowNumber}</th>
                      {preview.columns.map((column) => (
                        <td key={column}>
                          {previewValue(row.data[column], mapping[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section id="import-mapping" className="panel page-panel">
            <h2>3. Mapping and context</h2>
            <p>
              Review deterministic suggestions. Blank values remain missing and
              are not imported as zero.
            </p>
            <p>
              Choose the campaign and platform this data belongs to. Views,
              unique viewers, reach, and impressions are separate metrics; check
              each mapping before continuing.
            </p>
            {matchingTemplate && (
              <div className="notice" role="status">
                Previous mapping found from {matchingTemplate.displayName}.
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setMapping(matchingTemplate.mapping)}
                >
                  Apply previous mapping
                </button>
              </div>
            )}
            {preview.sheets.length > 1 && (
              <label className="import-field">
                Worksheet
                <select
                  value={selectedSheet}
                  onChange={(event) => setSelectedSheet(event.target.value)}
                >
                  {preview.sheets.map((sheet) => (
                    <option key={sheet}>{sheet}</option>
                  ))}
                </select>
              </label>
            )}
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
                  <span>Campaign</span>
                  <select
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
                  <option value="CREATE">Create new dataset</option>
                  <option value="APPEND">Add new rows to this dataset</option>
                  <option value="MERGE">
                    Add new columns/metrics to this dataset
                  </option>
                </select>
              </label>
              {datasetAction === 'MERGE' && (
                <p className="field-help">
                  Rows are matched by campaign, platform, and calendar record
                  date.
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
            <button
              className="primary"
              disabled={busy || !canValidate}
              onClick={() => void validate()}
            >
              {busy && preview ? 'Validating…' : 'Validate rows'}
            </button>
            {!canValidate && (
              <p className="field-help">
                Select an active platform, complete campaign mapping, and map
                Record date before validating.
              </p>
            )}
          </section>
          {campaignToCreate !== null && (
            <CreateImportCampaign
              initialName={campaignToCreate}
              currentUser={currentUser}
              channels={channels}
              preferredPlatformId={platformId}
              onClose={() => setCampaignToCreate(null)}
              onCreated={(campaign) => {
                setCampaigns((items) => [...items, campaign]);
                if (campaignToCreate && preview.campaignValues.length > 1)
                  setCampaignMappings((items) => ({
                    ...items,
                    [campaignToCreate]: campaign.id,
                  }));
                else setCampaignId(campaign.id);
                setCampaignToCreate(null);
              }}
            />
          )}
          {result && (
            <section id="import-validation" className="panel page-panel">
              <h2>4. Validation and confirmation</h2>
              {result.status === 'READY' && !validationCurrent && (
                <p className="notice" role="status">
                  Your import settings changed. Validate rows again before
                  confirming.
                </p>
              )}
              <div className="import-summary">
                <span>Total: {result.totalRows}</span>
                <span>Accepted: {result.acceptedRows}</span>
                <span>Rejected/conflicts: {result.rejectedRows}</span>
                <span>Warnings: {result.warningCount}</span>
              </div>
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">Validation results</caption>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Status</th>
                      <th>Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.sourceRowNumber}>
                        <th>{row.sourceRowNumber ?? '—'}</th>
                        <td>{row.status}</td>
                        <td>
                          {[...row.errors, ...row.warnings]
                            .map((issue) => issue.message)
                            .join(' ') || 'Ready'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="primary"
                disabled={
                  busy ||
                  !validationCurrent ||
                  result.status !== 'READY' ||
                  preview.duplicateCompleted
                }
                onClick={() => void confirm()}
              >
                Confirm import
              </button>
            </section>
          )}
        </>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <section className="panel page-panel">
        <div className="panel-heading">
          <div>
            <h2>Import history</h2>
            <p>
              Staged and completed files remain traceable by checksum and user.
            </p>
          </div>
        </div>
        {history.length ? (
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Import history</caption>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Source</th>
                  <th>Imported by</th>
                  <th>Rows</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id}>
                    <th>
                      {item.displayName || item.originalFilename}
                      <small className="table-secondary">
                        {item.originalFilename}
                      </small>
                    </th>
                    <td>{item.sourcePlatform || 'Generic'}</td>
                    <td>{item.importedByUser?.name || '—'}</td>
                    <td>
                      {item.acceptedRows}/{item.totalRows} accepted
                    </td>
                    <td>
                      <span
                        className={`status ${item.status === 'FAILED' || item.status === 'REJECTED' ? 'inactive' : ''}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td>{item.createdAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-table">No imports yet.</div>
        )}
      </section>
    </main>
  );
}
