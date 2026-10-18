'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  apiRequest,
  invalidateWorkspace,
  queryKeys,
} from '../../lib/api-client';
import { useSession } from '../auth/use-session';
import {
  WorkspaceNavigation,
  SectionNavigation,
} from '../../components/workspace-navigation';
import { CreateImportCampaign } from './create-import-campaign';
import { ImportFields } from './import-fields';
import { ImportHistory } from './import-history';
import { ImportReview } from './import-review';
import {
  destinations,
  type Campaign,
  type Channel,
  type HistoryItem,
  type Platform,
  type Preview,
  type Result,
  type ImportSummary,
  type ImportScope,
} from './import-types';

const actionLabels = {
  CREATE: 'Start data for this campaign/platform',
  APPEND: 'Add new dates',
  MERGE: 'Add missing metrics to matching dates',
};
const labels = [
  'Upload file',
  'Confirm details',
  'Review and import',
  'View results',
];
function fieldLabel(code: string) {
  return destinations.find(([value]) => value === code)?.[1] ?? code;
}
function resultsLink(scope: ImportScope) {
  const params = new URLSearchParams({
    campaignId: scope.campaignId,
    platformId: scope.platformId,
    from: scope.from,
    to: scope.to,
  });
  if (scope.metricCodes[0]) params.set('metricCode', scope.metricCodes[0]);
  return `/?${params}#overview`;
}

export function Imports() {
  const queryClient = useQueryClient();
  const sessionQuery = useSession();
  const currentUser = sessionQuery.data ?? null;
  const canImport =
    currentUser?.role.code === 'ADMIN' ||
    currentUser?.role.code === 'MARKETING_OFFICER';
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState('');
  const [campaignId, setCampaignId] = useState('');
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [campaignToCreate, setCampaignToCreate] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [committedSummary, setCommittedSummary] =
    useState<ImportSummary | null>(null);
  const [validatedConfiguration, setValidatedConfiguration] = useState<
    string | null
  >(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState('');
  const [contextAttempt, setContextAttempt] = useState(0);
  const [showIgnoredColumns, setShowIgnoredColumns] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [skipAcknowledged, setSkipAcknowledged] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [importToDelete, setImportToDelete] = useState<HistoryItem | null>(
    null,
  );
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const operation = useRef(false);
  const stagedFile = useRef<File | null>(null);
  const pendingDraft = Boolean(preview && step !== 3);
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
    preview?.source.type === 'EMAIL' && preview.campaignValues.length > 1
      ? preview.campaignValues.every((value) =>
          Boolean(campaignMappings[value]),
        )
      : Boolean(campaignId);
  const missing = [
    ...(!hasCampaignContext ? ['Choose a campaign, or create one below.'] : []),
    ...(!platformId ? ['Choose the platform this file belongs to.'] : []),
    ...(!Object.values(mapping).includes('recordDate')
      ? ['Review fields and select the record date column.']
      : []),
    ...(!Object.values(mapping).some((value) => /^[A-Z]+_/.test(value))
      ? ['Review fields and choose at least one raw metric.']
      : []),
    ...(displayName.trim().length < 2
      ? ['Give this import a name of at least two characters.']
      : []),
  ];
  const canValidate = Boolean(
    preview && !preview.duplicateCompleted && !missing.length,
  );

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!pendingDraft) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingDraft]);
  useEffect(() => {
    if (!currentUser || !canImport) return;
    let active = true;
    setContextLoading(true);
    setContextError('');
    void Promise.all([
      apiRequest<Campaign[]>('/campaigns'),
      apiRequest<Platform[]>('/platforms'),
      apiRequest<Channel[]>('/channels'),
      apiRequest<HistoryItem[]>('/imports'),
    ])
      .then(([nextCampaigns, nextPlatforms, nextChannels, nextHistory]) => {
        if (!active) return;
        setCampaigns(nextCampaigns);
        setPlatforms(nextPlatforms);
        setChannels(nextChannels);
        setHistory(nextHistory);
        const params = new URLSearchParams(window.location.search);
        const contextCampaign = nextCampaigns.find(
          (campaign) => campaign.id === params.get('campaignId'),
        );
        if (contextCampaign) setCampaignId(contextCampaign.id);
        const contextPlatform = nextPlatforms.find(
          (platform) =>
            platform.id === params.get('platformId') &&
            platform.active !== false &&
            platform.channel?.active !== false,
        );
        if (contextPlatform) setPlatformId(contextPlatform.id);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401)
          queryClient.setQueryData(queryKeys.session, null);
        else
          setContextError(
            cause instanceof Error
              ? cause.message
              : 'Import options could not be loaded.',
          );
      })
      .finally(() => {
        if (active) setContextLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUser?.id, canImport, queryClient, contextAttempt]);

  const canLeave = () =>
    !busy &&
    (!pendingDraft ||
      window.confirm(
        'Leave this unfinished import? Your file is staged, but this draft cannot be resumed after leaving.',
      ));
  const moveTo = (next: number) => {
    setStep(next);
    setError('');
    setSkipAcknowledged(false);
  };
  const exactCampaign = (name: string) => {
    const matches = campaigns.filter(
      (campaign) => campaign.name.trim() === name.trim(),
    );
    return matches.length === 1 ? matches[0].id : '';
  };
  const useSheet = (data: Preview, sheet: string) => {
    const next = data.sheetPreviews.find((item) => item.sheet === sheet);
    if (!next) return;
    const nextMapping = next.matchingTemplate?.mapping ?? next.suggestedMapping;
    setPreview({ ...data, ...next });
    setSelectedSheet(sheet);
    setMapping({ ...nextMapping });
    setDisplayNames(
      Object.fromEntries(next.columns.map((column) => [column, column])),
    );
    setCampaignMappings(
      Object.fromEntries(
        next.campaignValues.map((value) => [value, exactCampaign(value)]),
      ),
    );
    if (next.campaignValues.length === 1)
      setCampaignId(exactCampaign(next.campaignValues[0]) || campaignId);
    const mixedSocialSource =
      next.columns.some((column) => /facebook/i.test(column)) &&
      next.columns.some((column) => /instagram/i.test(column));
    const hint = mixedSocialSource
      ? null
      : next.source.platform === 'EMAIL'
        ? 'EMAIL_GENERIC'
        : next.source.platform;
    const suggestedPlatforms = hint
      ? platforms.filter(
          (platform) =>
            platform.active !== false &&
            platform.channel?.active !== false &&
            platform.code === hint,
        )
      : [];
    // Retain explicit context only if it does not contradict the detected source.
    const current = platforms.find((platform) => platform.id === platformId);
    const compatible =
      current &&
      current.active !== false &&
      current.channel?.active !== false &&
      (!hint ||
        current.code === hint ||
        (hint === 'EMAIL_GENERIC' &&
          channels.find((channel) => channel.id === current.channel?.id)
            ?.code === 'EMAIL'));
    setPlatformId(
      compatible
        ? platformId
        : suggestedPlatforms.length === 1
          ? suggestedPlatforms[0].id
          : '',
    );
    setResult(null);
    setValidatedConfiguration(null);
    setShowIgnoredColumns(false);
    setSkipAcknowledged(false);
    setMessage(
      next.matchingTemplate
        ? `Previous mapping from ${next.matchingTemplate.displayName} is selected. Review or change it below.`
        : 'Recognised fields are selected. Review the details, then click Next.',
    );
  };
  const upload = async () => {
    if (!file || operation.current || contextLoading || contextError) return;
    if (preview && file === stagedFile.current && step === 0) {
      moveTo(1);
      return;
    }
    if (!/\.(csv|json|xlsx)$/i.test(file.name)) {
      setError(
        file.name.toLowerCase().endsWith('.xls')
          ? 'Save this older Excel (.xls) file as XLSX in Excel or LibreOffice, then upload the copy. Renaming it does not convert it.'
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
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', file);
      const data = await apiRequest<Preview>('/imports/preview', {
        method: 'POST',
        body,
      });
      stagedFile.current = file;
      setDisplayName(data.displayName);
      setCommittedSummary(null);
      useSheet(data, data.sheets[0]);
      setShowDetails(false);
      moveTo(1);
      setHistory(await apiRequest<HistoryItem[]>('/imports'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The file could not be previewed. Try again.',
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const validate = async () => {
    if (!preview || !canValidate || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    setValidatedConfiguration(null);
    try {
      const data = await apiRequest<Result>(`/imports/${preview.id}/map`, {
        method: 'POST',
        body: {
          mapping,
          columnDisplayNames: displayNames,
          displayName: displayName.trim(),
          campaignId:
            preview.source.type === 'EMAIL' && preview.campaignValues.length > 1
              ? undefined
              : campaignId,
          campaignMappings:
            preview.source.type === 'EMAIL' && preview.campaignValues.length > 1
              ? campaignMappings
              : undefined,
          datasetAction,
          platformId,
          selectedSheet,
          sourcePlatform: preview.source.platform || undefined,
        },
      });
      setResult(data);
      setValidatedConfiguration(configuration);
      setMessage('');
      moveTo(2);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not check this file. Try again.',
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (
      !preview ||
      result?.status !== 'READY' ||
      !validationCurrent ||
      preview.duplicateCompleted ||
      (result.rejectedRows > 0 && !skipAcknowledged) ||
      operation.current
    )
      return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await apiRequest<{ status: string; summary: ImportSummary }>(
        `/imports/${preview.id}/confirm`,
        { method: 'POST' },
      );
      setCommittedSummary(data.summary);
      setResult({ ...result, status: data.status });
      moveTo(3);
      setMessage('Import completed. Your data is ready to view.');
      await invalidateWorkspace(queryClient);
      setHistory(await apiRequest<HistoryItem[]>('/imports'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Import could not be completed.',
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const startAnother = () => {
    stagedFile.current = null;
    setPreview(null);
    setFile(null);
    setMapping({});
    setDisplayNames({});
    setDisplayName('');
    setSelectedSheet('');
    setResult(null);
    setCommittedSummary(null);
    setValidatedConfiguration(null);
    setCampaignMappings({});
    setDatasetAction('APPEND');
    setShowDetails(false);
    setShowIgnoredColumns(false);
    setMessage(
      'Campaign and platform are kept for the next file. You can change them after upload.',
    );
    moveTo(0);
  };
  const cancelDelete = () => {
    setImportToDelete(null);
    deleteTrigger.current?.focus();
  };
  const deleteImport = async () => {
    if (!importToDelete || operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/imports/${importToDelete.id}`, { method: 'DELETE' });
      setHistory((items) =>
        items.filter((item) => item.id !== importToDelete.id),
      );
      if (preview?.id === importToDelete.id) {
        startAnother();
        setDatasetAction('CREATE');
      }
      setImportToDelete(null);
      setMessage('Import and its staged rows deleted.');
      requestAnimationFrame(() =>
        document.getElementById('import-history-title')?.focus(),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete import.',
      );
    } finally {
      operation.current = false;
      setBusy(false);
    }
  };
  const logout = async () => {
    await apiRequest('/auth/logout', { method: 'POST' });
    queryClient.setQueryData(queryKeys.session, null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== queryKeys.session[0],
    });
  };

  if (sessionQuery.isPending)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Checking your session</h1>
        </section>
      </main>
    );
  if (!currentUser)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Sign in required</h1>
          <p>Sign in to your workspace before importing data.</p>
          <Link className="primary download" href="/">
            Return to workspace
          </Link>
        </section>
      </main>
    );
  if (!canImport)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Results are available in your workspace</h1>
          <p>
            Your role can view results and download reports. Ask an
            Administrator or Marketing Officer to add data.
          </p>
          <Link className="primary download" href="/">
            View results
          </Link>
        </section>
      </main>
    );

  const activeChannels = channels
    .filter((channel) => channel.active !== false)
    .map((channel) => ({
      ...channel,
      platforms: channel.platforms.filter(
        (platform) => platform.active !== false,
      ),
    }));
  const activePlatforms = platforms.filter(
    (platform) =>
      platform.active !== false && platform.channel?.active !== false,
  );
  const multipleCampaigns =
    preview?.source.type === 'EMAIL' && preview.campaignValues.length > 1;
  const campaignLabel = multipleCampaigns
    ? preview.campaignValues
        .map(
          (name) =>
            campaigns.find((campaign) => campaign.id === campaignMappings[name])
              ?.name || `${name} — choose campaign`,
        )
        .join(', ')
    : campaigns.find((campaign) => campaign.id === campaignId)?.name ||
      'Choose a campaign';
  const platformLabel =
    platforms.find((platform) => platform.id === platformId)?.name ||
    'Choose a platform';

  return (
    <main className="shell">
      <a className="skip-link" href="#import-content">
        Skip to content
      </a>
      <WorkspaceNavigation
        currentUser={currentUser}
        view="imports"
        navigationOpen={navigationOpen}
        logout={logout}
        canLeave={canLeave}
      />
      <section
        id="import-content"
        className="content import-page"
        tabIndex={-1}
      >
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
          <div>
            <SectionNavigation
              currentUser={currentUser}
              view="imports"
              canLeave={canLeave}
            />
            <h1>Import performance data</h1>
          </div>
          <Link
            className="secondary"
            href="/"
            onClick={(event) => {
              if (!canLeave()) event.preventDefault();
            }}
          >
            Back to workspace
          </Link>
        </header>
        <ol className="import-steps" aria-label="Import steps">
          {labels.map((label, index) => (
            <li
              key={label}
              aria-current={step === index ? 'step' : undefined}
              className={step === index ? 'active' : ''}
            >
              <span>
                {index + 1}. {label}
              </span>
            </li>
          ))}
        </ol>
        {contextLoading && <p role="status">Loading import options…</p>}
        {contextError && (
          <div className="notice error" role="alert">
            {contextError}{' '}
            <button
              className="secondary"
              onClick={() => setContextAttempt((attempt) => attempt + 1)}
            >
              Retry
            </button>
          </div>
        )}
        {error && !importToDelete && (
          <div className="notice error" role="alert" tabIndex={-1}>
            {error}
          </div>
        )}
        {message && (
          <div className="notice" role="status">
            {message}
          </div>
        )}
        <section className="panel page-panel wizard-panel" aria-busy={busy}>
          <h2 ref={headingRef} tabIndex={-1}>
            {step + 1}. {labels[step]}
          </h2>
          {step === 0 && (
            <>
              <p>
                Choose your marketing export. We’ll recognise the fields and
                help you get to the results.
              </p>
              {campaignId && (
                <p>
                  For{' '}
                  {
                    campaigns.find((campaign) => campaign.id === campaignId)
                      ?.name
                  }
                  {platformId ? ` · ${platformLabel}` : ''}. You can change this
                  in the next step.
                </p>
              )}
              <label className="import-field">
                Select import file
                <input
                  key={preview?.id || 'new-file'}
                  type="file"
                  accept=".csv,.json,.xlsx"
                  disabled={busy}
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError('');
                  }}
                />
              </label>
              {file && <p className="field-help">Selected file: {file.name}</p>}
              <p className="field-help">
                CSV, JSON, or XLSX · Up to 10 MB. For older XLS files, save a
                copy as XLSX first.
              </p>
              <div className="wizard-actions">
                <button
                  className="primary"
                  disabled={
                    !file || busy || contextLoading || Boolean(contextError)
                  }
                  onClick={() => void upload()}
                >
                  {busy ? 'Reading file…' : 'Next'}
                </button>
              </div>
            </>
          )}
          {step === 1 && preview && (
            <>
              <p>
                Check where this data belongs. Suggested fields are ready to
                use; change only what needs correcting.
              </p>
              {preview.sheets.length > 1 && (
                <label className="import-field">
                  Worksheet
                  <select
                    value={selectedSheet}
                    disabled={busy}
                    onChange={(event) => {
                      useSheet(preview, event.target.value);
                      setShowDetails(false);
                    }}
                  >
                    {preview.sheets.map((sheet) => (
                      <option key={sheet}>{sheet}</option>
                    ))}
                  </select>
                  <span className="field-help">
                    Choose the worksheet to import. Details below update for
                    that worksheet.
                  </span>
                </label>
              )}
              {preview.duplicateCompleted && (
                <p className="notice error" role="alert">
                  This exact file was already imported. Choose another file; it
                  cannot be imported twice.
                </p>
              )}
              {preview.warnings
                .filter((warning) => !preview.duplicateCompleted)
                .map((warning) => (
                  <p className="notice" key={warning}>
                    {warning}
                  </p>
                ))}
              <dl className="detail-grid import-details-summary">
                <div>
                  <dt>Campaign</dt>
                  <dd>{campaignLabel}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{platformLabel}</dd>
                </div>
                <div>
                  <dt>Dates from file</dt>
                  <dd>
                    {preview.dateRange
                      ? `${preview.dateRange.from} – ${preview.dateRange.to}`
                      : 'Review date field'}
                  </dd>
                </div>
                <div>
                  <dt>Data</dt>
                  <dd>
                    {[
                      ...new Set(
                        Object.values(mapping).filter((code) =>
                          /^[A-Z]+_/.test(code),
                        ),
                      ),
                    ]
                      .map(fieldLabel)
                      .join(', ') || 'Review fields'}
                  </dd>
                </div>
                <div>
                  <dt>Action</dt>
                  <dd>{actionLabels[datasetAction]}</dd>
                </div>
                <div>
                  <dt>File</dt>
                  <dd>
                    {preview.filename} · {preview.rowCount} rows
                  </dd>
                </div>
              </dl>
              {activePlatforms.length === 0 && (
                <p className="notice">
                  No active platforms are available.{' '}
                  {currentUser.role.code === 'ADMIN' ? (
                    <Link
                      href="/#settings"
                      onClick={(event) => {
                        if (!canLeave()) event.preventDefault();
                      }}
                    >
                      Set up channels and platforms in Settings
                    </Link>
                  ) : (
                    'Ask your Administrator to set up a platform.'
                  )}
                </p>
              )}
              {missing.length > 0 && (
                <div className="notice" role="status">
                  <strong>A few details are needed:</strong>
                  <ul>
                    {missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!showDetails && !hasCampaignContext && !multipleCampaigns && (
                <div className="import-quick-context">
                  <label>
                    Campaign
                    <select
                      value={campaignId}
                      onChange={(event) => setCampaignId(event.target.value)}
                    >
                      <option value="">Select existing campaign</option>
                      {campaigns.map((campaign) => (
                        <option value={campaign.id} key={campaign.id}>
                          {campaign.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary"
                    onClick={() =>
                      setCampaignToCreate(preview.campaignValues[0] || '')
                    }
                  >
                    + Create new campaign
                  </button>
                </div>
              )}
              {!showDetails && !platformId && (
                <label className="import-field">
                  Platform
                  <select
                    aria-label="Platform"
                    value={platformId}
                    onChange={(event) => setPlatformId(event.target.value)}
                  >
                    <option value="">Select existing platform</option>
                    {activePlatforms.map((platform) => (
                      <option key={platform.id} value={platform.id}>
                        {platform.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                className="secondary"
                aria-expanded={showDetails}
                aria-controls="import-details"
                onClick={() => setShowDetails((show) => !show)}
              >
                {showDetails
                  ? 'Hide details'
                  : 'Change details / review fields'}
              </button>
              {(showDetails || (multipleCampaigns && !hasCampaignContext)) && (
                <div id="import-details">
                  <ImportFields
                    preview={preview}
                    displayName={displayName}
                    setDisplayName={setDisplayName}
                    campaignId={campaignId}
                    setCampaignId={setCampaignId}
                    campaigns={campaigns}
                    campaignMappings={campaignMappings}
                    setCampaignMappings={setCampaignMappings}
                    setCampaignToCreate={setCampaignToCreate}
                    platformId={platformId}
                    setPlatformId={setPlatformId}
                    platforms={platforms}
                    datasetAction={datasetAction}
                    setDatasetAction={setDatasetAction}
                    mapping={mapping}
                    setMapping={setMapping}
                    displayNames={displayNames}
                    setDisplayNames={setDisplayNames}
                    showIgnoredColumns={showIgnoredColumns}
                    setShowIgnoredColumns={setShowIgnoredColumns}
                  />
                </div>
              )}
              <details className="import-disclosure">
                <summary>Preview file ({preview.rowCount} rows)</summary>
                <div className="table-wrap">
                  <table>
                    <caption className="sr-only">Raw source preview</caption>
                    <thead>
                      <tr>
                        {preview.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.slice(0, 10).map((row) => (
                        <tr key={row.sourceRowNumber}>
                          {preview.columns.map((column) => (
                            <td key={column}>
                              {row.data[column] == null
                                ? '—'
                                : String(row.data[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Showing up to 10 source rows. All selected worksheet rows are
                  checked before import.
                </p>
              </details>
              <div className="wizard-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => moveTo(0)}
                >
                  Back
                </button>
                <button
                  className="primary"
                  disabled={busy || !canValidate}
                  onClick={() => void validate()}
                >
                  {busy ? 'Checking data…' : 'Next'}
                </button>
              </div>
            </>
          )}
          {step === 2 && result && (
            <>
              <p>
                {campaignLabel} · {platformLabel}
              </p>
              <p>{actionLabels[datasetAction]}</p>
              {result.summary.scopes.map((scope) => (
                <p key={`${scope.campaignId}:${scope.platformId}`}>
                  {
                    campaigns.find(
                      (campaign) => campaign.id === scope.campaignId,
                    )?.name
                  }{' '}
                  · {scope.from} – {scope.to} ·{' '}
                  {scope.metricCodes.map(fieldLabel).join(', ') ||
                    'Existing values unchanged'}
                </p>
              ))}
              <ImportReview result={result} />
              {datasetAction !== 'MERGE' &&
                result.rows.some((row) =>
                  row.errors.some(
                    (issue) =>
                      issue.code === 'EXISTING_RECORD_CONFLICT' &&
                      !/archived/i.test(issue.message),
                  ),
                ) && (
                  <div className="notice">
                    <p>
                      Some dates already have data. If this file adds metrics to
                      those dates, choose the option below. Existing values will
                      remain protected.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => {
                        setDatasetAction('MERGE');
                        moveTo(1);
                        setShowDetails(false);
                        setMessage(
                          'Add missing metrics is selected. Click Next to check for conflicts before importing.',
                        );
                      }}
                    >
                      Add missing metrics to matching dates
                    </button>
                  </div>
                )}
              {result.rejectedRows > 0 && result.status === 'READY' && (
                <label className="import-acknowledgement">
                  <input
                    type="checkbox"
                    checked={skipAcknowledged}
                    onChange={(event) =>
                      setSkipAcknowledged(event.target.checked)
                    }
                  />
                  Import {result.acceptedRows} accepted rows and exclude{' '}
                  {result.rejectedRows} rejected/conflicting rows.
                </label>
              )}
              {!validationCurrent && (
                <p role="status" className="notice">
                  Your details changed. Go back and click Next to check them
                  again.
                </p>
              )}
              <div className="wizard-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => moveTo(1)}
                >
                  Back / fix details
                </button>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !validationCurrent ||
                    result.status !== 'READY' ||
                    Boolean(preview?.duplicateCompleted) ||
                    (result.rejectedRows > 0 && !skipAcknowledged)
                  }
                  onClick={() => void confirm()}
                >
                  {busy ? 'Importing…' : 'Import data'}
                </button>
              </div>
            </>
          )}
          {step === 3 && committedSummary && (
            <>
              <h3>Import complete</h3>
              <p>
                {result?.acceptedRows} file rows accepted ·{' '}
                {committedSummary.dailyRecords} daily records ·{' '}
                {committedSummary.unchangedRecords} unchanged records
                {result?.rejectedRows
                  ? ` · ${result.rejectedRows} rows excluded`
                  : ''}
                .
              </p>
              <p>
                View results for the campaign, platform, and dates below.
                Results include existing data within this scope.
              </p>
              <div className="import-result-links">
                {committedSummary.scopes.map((scope) => (
                  <div key={`${scope.campaignId}:${scope.platformId}`}>
                    <p>
                      {
                        campaigns.find(
                          (campaign) => campaign.id === scope.campaignId,
                        )?.name
                      }{' '}
                      ·{' '}
                      {
                        platforms.find(
                          (platform) => platform.id === scope.platformId,
                        )?.name
                      }{' '}
                      · {scope.from} – {scope.to}
                    </p>
                    <Link
                      className="primary download"
                      href={resultsLink(scope)}
                    >
                      {committedSummary.scopes.length === 1
                        ? 'View results'
                        : `View results: ${campaigns.find((campaign) => campaign.id === scope.campaignId)?.name || 'campaign'}`}
                    </Link>
                  </div>
                ))}
              </div>
              <div className="wizard-actions">
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={startAnother}
                >
                  Add another file
                </button>
              </div>
            </>
          )}
        </section>
        {pendingDraft && (
          <p className="field-help">
            Back keeps your choices. Finish this import before leaving or
            refreshing; unfinished drafts cannot yet be resumed.
          </p>
        )}
        <button
          className="secondary"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((show) => !show)}
        >
          {showHistory ? 'Hide import history' : 'View import history'}
        </button>
        {showHistory && (
          <ImportHistory
            history={history}
            canDelete={currentUser.role.code === 'ADMIN'}
            busy={busy}
            onDelete={(item, trigger) => {
              deleteTrigger.current = trigger;
              setError('');
              setImportToDelete(item);
            }}
          />
        )}
        {campaignToCreate !== null && preview && (
          <CreateImportCampaign
            initialName={campaignToCreate}
            suggestedStartDate={preview.dateRange?.from ?? ''}
            currentUser={currentUser}
            channels={activeChannels}
            preferredPlatformId={platformId}
            onClose={() => setCampaignToCreate(null)}
            onCreated={(campaign) => {
              setCampaigns((items) => [...items, campaign]);
              if (campaignToCreate && multipleCampaigns)
                setCampaignMappings((items) => ({
                  ...items,
                  [campaignToCreate]: campaign.id,
                }));
              else setCampaignId(campaign.id);
              setCampaignToCreate(null);
            }}
          />
        )}
        {importToDelete && (
          <div
            className="modal-backdrop"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !busy) {
                event.preventDefault();
                cancelDelete();
              }
              if (event.key === 'Tab') {
                const buttons =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    'button:not(:disabled)',
                  );
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <section
              className="modal panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-import-title"
            >
              <h2 id="delete-import-title">Delete import?</h2>
              <p>
                Permanently delete{' '}
                {importToDelete.displayName || importToDelete.originalFilename}{' '}
                and its staged rows? This cannot be undone.
              </p>
              <button
                className="secondary"
                autoFocus
                disabled={busy}
                onClick={cancelDelete}
              >
                Cancel
              </button>{' '}
              <button
                className="primary danger"
                disabled={busy}
                onClick={() => void deleteImport()}
              >
                {busy ? 'Deleting…' : 'Delete import permanently'}
              </button>
              {error && <p role="alert">{error}</p>}
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
