'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiBlob, apiRequest } from '../../lib/api-client';
import type {
  Campaign,
  Channel,
  CurrentUser,
  DatasetCampaignResult,
  DatasetColumn,
  DatasetDetail,
  DatasetHistoryDetail,
  DatasetImportAttempt,
  DatasetRowsResult,
  HistoricalImport,
} from '../../lib/workspace-types';
import { DatasetJoinByDate } from './dataset-join-by-date';

function rawCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const cell = value as Record<string, unknown>;
  if (cell.$cell === 'number')
    return String(cell.displayText ?? cell.raw ?? '');
  if (cell.$cell === 'date') return String(cell.displayText ?? cell.iso ?? '');
  if (cell.$cell === 'richText' || cell.$cell === 'hyperlink')
    return String(cell.text ?? '');
  if (cell.$cell === 'formula') {
    const cached = rawCell(cell.cachedValue);
    return cached ? `${cached} (formula)` : String(cell.formula ?? 'Formula');
  }
  if (cell.$cell === 'error')
    return `Spreadsheet error: ${String(cell.value ?? '')}`;
  return JSON.stringify(value);
}

function formatDate(date: string) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        parsed,
      );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DatasetWorkspace({
  campaigns,
  currentUser,
  campaignId,
  onDraftChange,
}: {
  campaigns: Campaign[];
  currentUser: CurrentUser;
  campaignId?: string;
  onDraftChange?: (pending: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const canImport = ['ADMIN', 'MARKETING_OFFICER'].includes(
    currentUser.role.code,
  );
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => {
    if (campaignId) return campaignId;
    return typeof window === 'undefined'
      ? ''
      : (new URLSearchParams(window.location.search).get('campaignId') ?? '');
  });
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null,
  );
  const [selectedHistory, setSelectedHistory] =
    useState<HistoricalImport | null>(null);
  const [attempt, setAttempt] = useState<DatasetImportAttempt | null>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [dateColumnId, setDateColumnId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [chartColumnId, setChartColumnId] = useState('');
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [columnMetadata, setColumnMetadata] = useState<
    Record<string, { meaning: string; unit: string }>
  >({});
  const [confirmedColumnDetails, setConfirmedColumnDetails] = useState<{
    datasetId: string;
    labels: Record<string, string>;
    metadata: Record<string, { meaning: string; unit: string }>;
  } | null>(null);
  const [columnSaveState, setColumnSaveState] = useState<
    'clean' | 'saving' | 'saved' | 'failed'
  >('clean');
  const [savingColumns, setSavingColumns] = useState(false);
  const [templateId, setTemplateId] = useState('');
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignStartDate, setNewCampaignStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [campaignError, setCampaignError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const uploadFileInput = useRef<HTMLInputElement>(null);
  const replacementFileInput = useRef<HTMLInputElement>(null);
  const refreshedDeepLinkCampaign = useRef<string | null>(null);
  const fixedCampaign = Boolean(campaignId);
  const campaign = campaigns.find((item) => item.id === selectedCampaignId);
  const campaignQuery = useQuery({
    queryKey: ['datasets', 'campaign', selectedCampaignId],
    enabled: Boolean(selectedCampaignId),
    queryFn: () =>
      apiRequest<DatasetCampaignResult>(
        `/datasets/campaigns/${selectedCampaignId}`,
      ),
  });
  const dataset = useQuery({
    queryKey: ['dataset', selectedDatasetId],
    enabled: Boolean(selectedDatasetId),
    queryFn: () => apiRequest<DatasetDetail>(`/datasets/${selectedDatasetId}`),
  });
  const columns = dataset.data?.columns ?? [];
  const hasUnsavedColumnDetails = Boolean(
    dataset.data &&
    confirmedColumnDetails?.datasetId === dataset.data.id &&
    columns.some((column) => {
      const original = confirmedColumnDetails.labels[column.id] ?? column.label;
      const savedMetadata = confirmedColumnDetails.metadata[column.id] ?? {
        meaning: '',
        unit: '',
      };
      const draftMetadata = columnMetadata[column.id] ?? {
        meaning: '',
        unit: '',
      };
      return (
        (labels[column.id] ?? column.label) !== original ||
        (draftMetadata.meaning ?? '') !== (savedMetadata.meaning ?? '') ||
        (draftMetadata.unit ?? '') !== (savedMetadata.unit ?? '')
      );
    }),
  );
  const dateColumns = columns.filter((column) => column.type === 'date');
  const numericColumns = columns.filter((column) => column.type === 'number');
  const rowsQuery = useQuery({
    queryKey: [
      'dataset-rows',
      selectedDatasetId,
      dataset.data?.currentRevision,
      page,
      search,
      dateColumnId,
      from,
      to,
    ],
    enabled: Boolean(selectedDatasetId && dataset.data),
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '50',
      });
      params.set('expectedRevision', String(dataset.data!.currentRevision));
      if (search.trim()) params.set('search', search.trim());
      if (dateColumnId) params.set('dateColumnId', dateColumnId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return apiRequest<DatasetRowsResult>(
        `/datasets/${selectedDatasetId}/rows?${params}`,
      );
    },
  });
  const historyQuery = useQuery({
    queryKey: [
      'dataset-history',
      selectedCampaignId,
      selectedHistory?.id,
      page,
    ],
    enabled: Boolean(selectedHistory && selectedCampaignId),
    queryFn: () =>
      apiRequest<DatasetHistoryDetail>(
        `/datasets/campaigns/${selectedCampaignId}/history/${selectedHistory!.id}?page=${page}&pageSize=50`,
      ),
  });
  const rows = rowsQuery.data?.rows ?? [];
  const rowColumns = columns;
  const chartData = useMemo(() => {
    const selectedColumn = numericColumns.find(
      (column) => column.id === chartColumnId,
    );
    if (!selectedColumn) return [];
    const dateColumn =
      columns.find((column) => column.type === 'date') ??
      columns.find((column) => /^date$/i.test(column.originalName.trim()));
    return rows.flatMap((row) => {
      const typed = row.typedCells[selectedColumn.ordinal];
      const value = Number(typed?.value);
      return typed?.kind === 'number' &&
        Number.isFinite(value) &&
        Math.abs(value) <= Number.MAX_SAFE_INTEGER
        ? [
            {
              sourceRow: row.sourceRowNumber,
              date: dateColumn
                ? rawCell(row.cells[dateColumn.ordinal]).replace(
                    /^(\d{4}-\d{2}-\d{2})T.*$/,
                    '$1',
                  )
                : undefined,
              value,
              exactValue: rawCell(row.cells[selectedColumn.ordinal]),
            },
          ]
        : [];
    });
  }, [chartColumnId, numericColumns, columns, rows]);
  const pendingDraft = Boolean(
    attempt ||
    file ||
    replaceTargetId ||
    (createCampaignOpen && newCampaignName.trim()),
  );

  useEffect(() => {
    if (campaignId) {
      setSelectedCampaignId(campaignId);
      return;
    }
    if (!campaigns.length) return;
    const urlCampaign = new URLSearchParams(window.location.search).get(
      'campaignId',
    );
    if (urlCampaign && campaigns.some((item) => item.id === urlCampaign)) {
      refreshedDeepLinkCampaign.current = null;
      setSelectedCampaignId(urlCampaign);
      return;
    }
    if (urlCampaign) {
      if (campaignQuery.isFetching) return;
      if (refreshedDeepLinkCampaign.current !== urlCampaign) {
        refreshedDeepLinkCampaign.current = urlCampaign;
        void campaignQuery.refetch();
        return;
      }
      setSelectedCampaignId(campaigns[0]!.id);
      return;
    }
    if (!selectedCampaignId) setSelectedCampaignId(campaigns[0]!.id);
  }, [
    campaignId,
    campaignQuery.isFetching,
    campaignQuery.refetch,
    campaigns,
    selectedCampaignId,
  ]);

  useEffect(() => {
    const restoreDataset = () => {
      const params = new URLSearchParams(window.location.search);
      const urlCampaign = params.get('campaignId');
      if (!campaignId && urlCampaign) setSelectedCampaignId(urlCampaign);
      else if (!campaignId && !urlCampaign && campaigns.length)
        setSelectedCampaignId(campaigns[0]!.id);
      setSelectedDatasetId(params.get('datasetId'));
      const historyId = params.get('historyId');
      if (historyId) {
        const match = campaignQuery.data?.historicalImports.find(
          (item) => item.id === historyId,
        );
        setSelectedHistory(match ?? null);
      } else setSelectedHistory(null);
    };
    restoreDataset();
    window.addEventListener('popstate', restoreDataset);
    return () => window.removeEventListener('popstate', restoreDataset);
  }, [campaignId, campaignQuery.data?.historicalImports, campaigns]);

  useEffect(() => {
    onDraftChange?.(pendingDraft);
  }, [onDraftChange, pendingDraft]);

  useEffect(() => {
    if (!pendingDraft) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingDraft]);

  useEffect(() => {
    if (!dataset.data || dataset.data.id !== selectedDatasetId) return;
    if (confirmedColumnDetails?.datasetId === dataset.data.id) return;
    const nextLabels = Object.fromEntries(
      dataset.data.columns.map((column) => [column.id, column.label]),
    );
    const nextMetadata = Object.fromEntries(
      dataset.data.columns.map((column) => [
        column.id,
        { meaning: column.meaning ?? '', unit: column.unit ?? '' },
      ]),
    );
    setLabels(nextLabels);
    setColumnMetadata(nextMetadata);
    setConfirmedColumnDetails({
      datasetId: dataset.data.id,
      labels: nextLabels,
      metadata: nextMetadata,
    });
    setColumnSaveState('clean');
    setDateColumnId(
      dataset.data.columns.find((column) => column.type === 'date')?.id ?? '',
    );
    setChartColumnId(
      dataset.data.columns.find((column) => column.type === 'number')?.id ?? '',
    );
    setPage(1);
    setSearch('');
    setFrom('');
    setTo('');
  }, [confirmedColumnDetails?.datasetId, dataset.data, selectedDatasetId]);

  const setUrlContext = (
    next: {
      campaignId?: string;
      datasetId?: string | null;
      historyId?: string | null;
    },
    push = true,
  ) => {
    const url = new URL(window.location.href);
    if (next.campaignId) url.searchParams.set('campaignId', next.campaignId);
    else url.searchParams.delete('campaignId');
    if (next.datasetId) url.searchParams.set('datasetId', next.datasetId);
    else url.searchParams.delete('datasetId');
    if (next.historyId) url.searchParams.set('historyId', next.historyId);
    else url.searchParams.delete('historyId');
    if (push) window.history.pushState({}, '', url);
    else window.history.replaceState({}, '', url);
  };

  const openDataset = (id: string) => {
    setSelectedDatasetId(id);
    setSelectedHistory(null);
    setError('');
    setUrlContext({ campaignId: selectedCampaignId, datasetId: id });
  };

  const openHistory = (item: HistoricalImport) => {
    setSelectedDatasetId(null);
    setSelectedHistory(item);
    setPage(1);
    setUrlContext({ campaignId: selectedCampaignId, historyId: item.id });
  };

  const closeViewer = () => {
    setSelectedDatasetId(null);
    setSelectedHistory(null);
    setUrlContext({ campaignId: selectedCampaignId });
  };

  const startReplace = (datasetId: string) => {
    setReplaceTargetId(datasetId);
    setAttempt(null);
    setFile(null);
    setError('');
    setSelectedDatasetId(null);
    setSelectedHistory(null);
    setUrlContext({ campaignId: selectedCampaignId });
    if (replacementFileInput.current) replacementFileInput.current.value = '';
    replacementFileInput.current?.click();
  };

  const startUpload = async () => {
    if (!file || !selectedCampaignId) return;
    const selectedFile = file;
    if (replaceTargetId && replacementFileInput.current)
      replacementFileInput.current.value = '';
    else if (uploadFileInput.current) uploadFileInput.current.value = '';
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.set('campaignId', selectedCampaignId);
      form.set('file', selectedFile);
      if (replaceTargetId) form.set('datasetId', replaceTargetId);
      const result = await apiRequest<DatasetImportAttempt>(
        '/datasets/imports/preview',
        {
          method: 'POST',
          body: form,
        },
      );
      setAttempt(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The file could not be prepared.',
      );
    } finally {
      setBusy(false);
    }
  };

  const selectSheet = async (selectedSheet: string) => {
    if (!attempt) return;
    setBusy(true);
    setError('');
    try {
      setAttempt(
        await apiRequest<DatasetImportAttempt>(
          `/datasets/imports/${attempt.id}/sheet`,
          {
            method: 'POST',
            body: { selectedSheet },
          },
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The worksheet could not be selected.',
      );
    } finally {
      setBusy(false);
    }
  };

  const useDuplicateAsReplacement = async () => {
    if (!attempt?.duplicate) return;
    const target = attempt.duplicate.dataset;
    setBusy(true);
    setError('');
    try {
      setAttempt(
        await apiRequest<DatasetImportAttempt>(
          `/datasets/imports/${attempt.id}/replace`,
          {
            method: 'POST',
            body: {
              targetDatasetId: target.id,
              expectedVersion: target.version,
            },
          },
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The replacement could not be prepared.',
      );
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = async () => {
    if (!attempt || !templateId) return;
    setBusy(true);
    setError('');
    try {
      setAttempt(
        await apiRequest<DatasetImportAttempt>(
          `/datasets/imports/${attempt.id}/template`,
          {
            method: 'POST',
            body: { templateId },
          },
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The template could not be applied.',
      );
    } finally {
      setBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!attempt?.selected) return;
    if (attempt.operation === 'REPLACE') {
      const old = campaignQuery.data?.datasets.find(
        (item) => item.id === attempt.targetDatasetId,
      );
      const approved = window.confirm(
        `Replace ${old?.name ?? 'this dataset'} with ${attempt.selected.rowCount} rows? The current dataset stays available if import fails.`,
      );
      if (!approved) return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<DatasetDetail>(
        `/datasets/imports/${attempt.id}/confirm`,
        {
          method: 'POST',
          body: {},
        },
      );
      setAttempt(null);
      setReplaceTargetId(null);
      setFile(null);
      await queryClient.invalidateQueries({
        queryKey: ['datasets', 'campaign', selectedCampaignId],
      });
      await queryClient.invalidateQueries({ queryKey: ['dataset', result.id] });
      openDataset(result.id);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The dataset could not be imported.',
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelAttempt = () => {
    if (uploadFileInput.current) uploadFileInput.current.value = '';
    if (replacementFileInput.current) replacementFileInput.current.value = '';
    setAttempt(null);
    setFile(null);
    setReplaceTargetId(null);
    setError('');
  };

  const saveLabels = async () => {
    if (!dataset.data || !hasUnsavedColumnDetails || savingColumns) return;
    setBusy(true);
    setSavingColumns(true);
    setColumnSaveState('saving');
    setError('');
    try {
      const result = await apiRequest<DatasetDetail>(
        `/datasets/${dataset.data.id}/columns`,
        {
          method: 'PATCH',
          body: {
            columns: dataset.data.columns.map((column) => ({
              id: column.id,
              label: labels[column.id] ?? column.label,
              meaning: columnMetadata[column.id]?.meaning ?? '',
              unit: columnMetadata[column.id]?.unit ?? '',
            })),
          },
        },
      );
      queryClient.setQueryData(['dataset', result.id], result);
      const savedLabels = Object.fromEntries(
        result.columns.map((column) => [column.id, column.label]),
      );
      const savedMetadata = Object.fromEntries(
        result.columns.map((column) => [
          column.id,
          { meaning: column.meaning ?? '', unit: column.unit ?? '' },
        ]),
      );
      setLabels(savedLabels);
      setColumnMetadata(savedMetadata);
      setConfirmedColumnDetails({
        datasetId: result.id,
        labels: savedLabels,
        metadata: savedMetadata,
      });
      setColumnSaveState('saved');
    } catch (cause) {
      setColumnSaveState('failed');
      setError(
        cause instanceof Error
          ? cause.message
          : 'Column labels could not be saved.',
      );
    } finally {
      setSavingColumns(false);
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!dataset.data) return;
    const name = window.prompt('Name this import template');
    if (!name?.trim()) return;
    setBusy(true);
    setError('');
    try {
      await apiRequest('/datasets/templates', {
        method: 'POST',
        body: {
          name: name.trim(),
          headerFingerprint: dataset.data.headerFingerprint,
          rules: {
            columns: dataset.data.columns
              .filter(
                (column) =>
                  (labels[column.id] ?? column.label) !== column.originalName,
              )
              .map((column) => ({
                id: column.id,
                label: labels[column.id] ?? column.label,
              })),
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['dataset-templates'] });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The template could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteDataset = async (
    item: DatasetDetail | DatasetCampaignResult['datasets'][number],
  ) => {
    if (
      !window.confirm(
        `Delete ${item.name} and all imported rows? The campaign will remain.`,
      )
    )
      return;
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/datasets/${item.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({
        queryKey: ['datasets', 'campaign', selectedCampaignId],
      });
      setSelectedDatasetId(null);
      setUrlContext({ campaignId: selectedCampaignId });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The dataset could not be deleted.',
      );
    } finally {
      setBusy(false);
    }
  };

  const exportDataset = async (format: 'csv' | 'pdf') => {
    if (!dataset.data) return;
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (dateColumnId) params.set('dateColumnId', dateColumnId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('expectedRevision', String(dataset.data.currentRevision));
      if (format === 'pdf' && chartColumnId)
        params.set('chartColumnId', chartColumnId);
      const blob = await apiBlob(
        `/datasets/${dataset.data.id}/export.${format}?${params}`,
      );
      saveBlob(blob, `${dataset.data.name}.${format}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The export could not be created.',
      );
    }
  };

  const clearErrorOnCampaignChange = (nextId: string) => {
    setSelectedCampaignId(nextId);
    setSelectedDatasetId(null);
    setSelectedHistory(null);
    setAttempt(null);
    setFile(null);
    setPage(1);
    setError('');
    setUrlContext({ campaignId: nextId }, false);
  };

  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canImport) return;
    setCampaignError('');
    try {
      const created = await apiRequest<Campaign>('/campaigns', {
        method: 'POST',
        body: {
          name: newCampaignName.trim(),
          startDate: newCampaignStartDate,
          responsibleUserId: currentUser.id,
          channels: [],
        },
      });
      queryClient.setQueryData<{
        campaigns: Campaign[];
        channels: Channel[];
      }>(['workspace-context', currentUser.id], (context) =>
        context
          ? { ...context, campaigns: [created, ...context.campaigns] }
          : context,
      );
      setCreateCampaignOpen(false);
      setNewCampaignName('');
      setSelectedCampaignId(created.id);
      setAttempt(null);
      setFile(null);
      setSelectedDatasetId(null);
      setSelectedHistory(null);
      setPage(1);
      setUrlContext({ campaignId: created.id }, false);
      await queryClient.invalidateQueries({
        queryKey: ['datasets', 'campaign', created.id],
      });
    } catch (cause) {
      setCampaignError(
        cause instanceof Error
          ? cause.message
          : 'The campaign could not be created.',
      );
    }
  };

  return (
    <section className="panel page-panel dataset-workspace">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Campaign files</p>
          <h2>
            {fixedCampaign ? (campaign?.name ?? 'Campaign data') : 'Your data'}
          </h2>
          <p>
            Upload a file, choose a campaign, and keep each import as its own
            dataset.
          </p>
        </div>
        {!fixedCampaign ? (
          <div className="dataset-campaign-actions">
            <label className="dataset-campaign-picker">
              Campaign
              <select
                value={selectedCampaignId}
                onChange={(event) =>
                  clearErrorOnCampaignChange(event.target.value)
                }
              >
                <option value="">Choose a campaign</option>
                {campaigns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {canImport ? (
              <button
                className="secondary"
                type="button"
                onClick={() => setCreateCampaignOpen((open) => !open)}
              >
                {createCampaignOpen ? 'Cancel new campaign' : 'Create campaign'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {campaignError ? (
        <p className="notice error" role="alert">
          {campaignError}
        </p>
      ) : null}
      {createCampaignOpen && !fixedCampaign ? (
        <form
          className="panel nested-form dataset-new-campaign"
          onSubmit={(event) => void createCampaign(event)}
        >
          <h3>Create a campaign</h3>
          <p className="field-help">
            Channels and platforms are optional. You can organize imported files
            without selecting them.
          </p>
          <div className="form-grid">
            <label>
              Campaign name
              <input
                required
                minLength={2}
                maxLength={180}
                value={newCampaignName}
                onChange={(event) => setNewCampaignName(event.target.value)}
              />
            </label>
            <label>
              Start date
              <input
                type="date"
                required
                value={newCampaignStartDate}
                onChange={(event) =>
                  setNewCampaignStartDate(event.target.value)
                }
              />
            </label>
          </div>
          <button className="primary" type="submit">
            Create and select campaign
          </button>
        </form>
      ) : null}

      {selectedDatasetId ? (
        <DatasetViewer
          key={selectedDatasetId}
          dataset={dataset.data ?? null}
          loading={dataset.isPending || rowsQuery.isPending}
          error={dataset.error || rowsQuery.error}
          rows={rowsQuery.data ?? null}
          columns={rowColumns}
          labels={labels}
          setLabels={setLabels}
          columnMetadata={columnMetadata}
          setColumnMetadata={setColumnMetadata}
          canEdit={canImport && Boolean(dataset.data?.capabilities.replace)}
          canDelete={
            currentUser.role.code === 'ADMIN' &&
            Boolean(dataset.data?.capabilities.delete)
          }
          busy={busy}
          savingColumns={savingColumns}
          hasUnsavedColumnDetails={hasUnsavedColumnDetails}
          columnSaveState={columnSaveState}
          search={search}
          setSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
          dateColumnId={dateColumnId}
          setDateColumnId={(value) => {
            setDateColumnId(value);
            setPage(1);
          }}
          from={from}
          setFrom={(value) => {
            setFrom(value);
            setPage(1);
          }}
          to={to}
          setTo={(value) => {
            setTo(value);
            setPage(1);
          }}
          chartColumnId={chartColumnId}
          setChartColumnId={setChartColumnId}
          numericColumns={numericColumns}
          dateColumns={dateColumns}
          chartData={chartData}
          onBack={closeViewer}
          onSaveLabels={() => void saveLabels()}
          onSaveTemplate={() => void saveTemplate()}
          onReplace={() => dataset.data && startReplace(dataset.data.id)}
          onDelete={() => dataset.data && void deleteDataset(dataset.data)}
          onExport={(format) => void exportDataset(format)}
          onPage={setPage}
        />
      ) : selectedHistory ? (
        <HistoricalViewer
          item={selectedHistory}
          result={historyQuery.data ?? null}
          loading={historyQuery.isPending}
          error={historyQuery.error}
          page={page}
          setPage={setPage}
          onBack={closeViewer}
        />
      ) : (
        <>
          {canImport && selectedCampaignId ? (
            <form
              className="dataset-upload panel nested-form"
              onSubmit={(event) => {
                event.preventDefault();
                void startUpload();
              }}
            >
              <div>
                <h3>
                  {replaceTargetId
                    ? 'Replace dataset contents'
                    : 'Upload a dataset'}
                </h3>
                <p className="muted-text">
                  CSV, XLSX, or tabular JSON. Every upload remains separate,
                  even when dates or columns overlap.
                </p>
              </div>
              {!replaceTargetId ? (
                <label>
                  Select a file
                  <input
                    ref={uploadFileInput}
                    type="file"
                    accept=".csv,.xlsx,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => {
                      setFile(event.target.files?.[0] ?? null);
                    }}
                  />
                </label>
              ) : (
                <p className="muted-text">
                  Choose a corrected file to replace this dataset.
                </p>
              )}
              {file ? (
                <p className="muted-text">Selected: {file.name}</p>
              ) : null}
              {attempt?.sheetSelectionRequired ? (
                <label>
                  Worksheet
                  <select
                    defaultValue=""
                    disabled={busy}
                    onChange={(event) => void selectSheet(event.target.value)}
                  >
                    <option value="" disabled>
                      Choose a worksheet
                    </option>
                    {attempt.sheets.map((sheet) => (
                      <option key={sheet.key} value={sheet.key}>
                        {sheet.name} · {sheet.rowCount} rows
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {attempt?.duplicate ? (
                <div className="notice">
                  <strong>
                    This exact file and worksheet are already in this campaign.
                  </strong>
                  <p>
                    {attempt.duplicate.dataset.name} ·{' '}
                    {attempt.duplicate.dataset.rowCount} rows
                  </p>
                  <div className="button-row">
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => openDataset(attempt.duplicate!.dataset.id)}
                    >
                      View existing dataset
                    </button>
                    {attempt.duplicate.actions.replace ? (
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={() => void useDuplicateAsReplacement()}
                      >
                        Replace existing dataset
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {attempt?.selected ? (
                <>
                  {attempt.matchingTemplates?.length ? (
                    <div className="dataset-template-choice">
                      <label>
                        Saved column labels
                        <select
                          value={templateId}
                          onChange={(event) =>
                            setTemplateId(event.target.value)
                          }
                        >
                          <option value="">Keep current labels</option>
                          {attempt.matchingTemplates.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="secondary"
                        disabled={!templateId || busy}
                        onClick={() => void applyTemplate()}
                      >
                        Apply template
                      </button>
                    </div>
                  ) : null}
                  <p className="muted-text">
                    {attempt.selected.name} ·{' '}
                    {attempt.selected.columns?.length ?? 0} columns ·{' '}
                    {attempt.selected.rowCount} rows
                  </p>
                  <div
                    className="table-scroll"
                    tabIndex={0}
                    aria-label="Import preview"
                  >
                    <table aria-label="Import preview">
                      <thead>
                        <tr>
                          {attempt.selected.columns?.map((column) => (
                            <th key={column.id}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attempt.selected.sampleRows.slice(0, 5).map((row) => (
                          <tr key={row.sourceRowNumber}>
                            {attempt.selected!.columns?.map((column) => (
                              <td key={column.id}>
                                {rawCell(row.cells[column.ordinal])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {attempt.duplicate ? null : (
                    <div className="button-row">
                      {attempt.selected.rowCount < 1 ? (
                        <p className="field-help">
                          This worksheet has no data rows, so it cannot be
                          imported or used to replace a dataset.
                        </p>
                      ) : null}
                      {attempt.selected && attempt.status === 'READY' ? (
                        <button
                          type="button"
                          className="primary"
                          disabled={busy || attempt.selected.rowCount < 1}
                          onClick={() => void confirmImport()}
                        >
                          {attempt.operation === 'REPLACE'
                            ? 'Confirm replacement'
                            : 'Import dataset'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="secondary"
                        disabled={busy}
                        onClick={cancelAttempt}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </>
              ) : !attempt?.sheetSelectionRequired ? (
                <>
                  <button
                    type="submit"
                    className="primary"
                    disabled={busy || !file}
                  >
                    {busy ? 'Preparing…' : 'Preview file'}
                  </button>
                  {!file ? (
                    <span className="field-help">
                      Select a file to enable preview.
                    </span>
                  ) : null}
                </>
              ) : null}
              {replaceTargetId && !attempt ? (
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={cancelAttempt}
                >
                  Cancel replacement
                </button>
              ) : null}
            </form>
          ) : null}

          {selectedCampaignId && canImport && !attempt && !replaceTargetId
            ? null
            : null}
          {selectedCampaignId && campaignQuery.isPending ? (
            <p role="status">Loading campaign datasets…</p>
          ) : null}
          {campaignQuery.error ? (
            <p className="notice error" role="alert">
              {campaignQuery.error instanceof Error
                ? campaignQuery.error.message
                : 'Campaign data could not be loaded.'}
            </p>
          ) : null}
          {campaignQuery.data ? (
            <DatasetJoinByDate
              key={selectedCampaignId}
              datasets={campaignQuery.data.datasets}
            />
          ) : null}
          {campaignQuery.data ? (
            <>
              <section className="dataset-list" aria-label="Campaign datasets">
                <div className="panel-heading">
                  <div>
                    <h3>Datasets</h3>
                    <p>Each upload keeps its own rows and columns.</p>
                  </div>
                </div>
                {campaignQuery.data.datasets.length ? (
                  <div className="dataset-cards">
                    {campaignQuery.data.datasets.map((item) => (
                      <article className="dataset-card" key={item.id}>
                        <div>
                          <h4>{item.name}</h4>
                          <p>
                            {item.sourceFilename}
                            {item.worksheetName
                              ? ` · ${item.worksheetName}`
                              : ''}
                          </p>
                          <p className="muted-text">
                            {item.rowCount} rows · imported{' '}
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                        <div className="button-row">
                          <button
                            className="secondary"
                            onClick={() => openDataset(item.id)}
                          >
                            View
                          </button>
                          {item.capabilities.replace ? (
                            <button
                              className="secondary"
                              onClick={() => startReplace(item.id)}
                            >
                              Replace
                            </button>
                          ) : null}
                          {item.capabilities.delete ? (
                            <button
                              className="secondary danger"
                              onClick={() => void deleteDataset(item)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <h4>No datasets in this campaign yet</h4>
                    <p>
                      {canImport
                        ? 'Upload a file above to add the first dataset.'
                        : 'Datasets will appear when your team imports a file.'}
                    </p>
                  </div>
                )}
              </section>
              {campaignQuery.data.historicalImports.length ? (
                <section
                  className="dataset-list historical-datasets"
                  aria-label="Historical imports"
                >
                  <div className="panel-heading">
                    <div>
                      <h3>Earlier imports</h3>
                      <p>
                        Current records are shown where they can still be linked
                        to an import.
                      </p>
                    </div>
                  </div>
                  <div className="dataset-cards">
                    {campaignQuery.data.historicalImports.map((item) => (
                      <article className="dataset-card" key={item.id}>
                        <div>
                          <h4>{item.name}</h4>
                          <p>
                            {item.sourceFilename}
                            {item.worksheetName
                              ? ` · ${item.worksheetName}`
                              : ''}
                          </p>
                          <p className="muted-text">
                            {item.availableRecordCount} available records ·{' '}
                            {formatDate(item.importedAt)}
                          </p>
                          <p className="field-help">
                            Viewing only. The original file is unavailable, so
                            replacement and deletion cannot be offered.
                          </p>
                        </div>
                        <button
                          className="secondary"
                          onClick={() => openHistory(item)}
                        >
                          View available records
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <input
        ref={replacementFileInput}
        hidden
        type="file"
        aria-label="Upload replacement file"
        accept=".csv,.xlsx,.json"
        tabIndex={-1}
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
        }}
      />
    </section>
  );
}

function DatasetViewer({
  dataset,
  loading,
  error,
  rows,
  columns,
  labels,
  setLabels,
  columnMetadata,
  setColumnMetadata,
  canEdit,
  canDelete,
  busy,
  savingColumns,
  hasUnsavedColumnDetails,
  columnSaveState,
  search,
  setSearch,
  dateColumnId,
  setDateColumnId,
  from,
  setFrom,
  to,
  setTo,
  chartColumnId,
  setChartColumnId,
  numericColumns,
  dateColumns,
  chartData,
  onBack,
  onSaveLabels,
  onSaveTemplate,
  onReplace,
  onDelete,
  onExport,
  onPage,
}: {
  dataset: DatasetDetail | null;
  loading: boolean;
  error: unknown;
  rows: DatasetRowsResult | null;
  columns: DatasetColumn[];
  labels: Record<string, string>;
  setLabels: (value: Record<string, string>) => void;
  columnMetadata: Record<string, { meaning: string; unit: string }>;
  setColumnMetadata: (
    value: Record<string, { meaning: string; unit: string }>,
  ) => void;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  savingColumns: boolean;
  hasUnsavedColumnDetails: boolean;
  columnSaveState: 'clean' | 'saving' | 'saved' | 'failed';
  search: string;
  setSearch: (value: string) => void;
  dateColumnId: string;
  setDateColumnId: (value: string) => void;
  from: string;
  setFrom: (value: string) => void;
  to: string;
  setTo: (value: string) => void;
  chartColumnId: string;
  setChartColumnId: (value: string) => void;
  numericColumns: DatasetColumn[];
  dateColumns: DatasetColumn[];
  chartData: Array<{
    sourceRow: number;
    date?: string;
    value: number;
    exactValue: string;
  }>;
  onBack: () => void;
  onSaveLabels: () => void;
  onSaveTemplate: () => void;
  onReplace: () => void;
  onDelete: () => void;
  onExport: (format: 'csv' | 'pdf') => void;
  onPage: (page: number) => void;
}) {
  const [sourceRowsOpen, setSourceRowsOpen] = useState(false);
  if (loading && !dataset) return <p role="status">Loading dataset…</p>;
  if (error)
    return (
      <p className="notice error" role="alert">
        {error instanceof Error
          ? error.message
          : 'Dataset could not be loaded.'}
      </p>
    );
  if (!dataset)
    return <p className="notice">Dataset details are unavailable.</p>;
  return (
    <section className="panel dataset-viewer" aria-label="Dataset rows">
      <button
        type="button"
        className="secondary dataset-back-action"
        onClick={onBack}
      >
        ← Back to campaign data
      </button>
      <div className="panel-heading detail-heading">
        <div>
          <p className="eyebrow">{dataset.campaign.name}</p>
          <h3>{dataset.name}</h3>
          <p>
            {dataset.sourceFilename}
            {dataset.worksheetName ? ` · ${dataset.worksheetName}` : ''} ·{' '}
            {dataset.rowCount} rows
          </p>
          <p className="dataset-saved-status" role="status">
            Dataset saved · {dataset.rowCount} rows
          </p>
        </div>
        <div className="button-row">
          {dataset.capabilities.replace ? (
            <button className="secondary" onClick={onReplace}>
              Replace
            </button>
          ) : null}
          {canDelete ? (
            <button className="secondary danger" onClick={onDelete}>
              Delete
            </button>
          ) : null}
        </div>
      </div>
      {dataset.explanation ? (
        <p className="notice">{dataset.explanation}</p>
      ) : null}
      {canEdit ? (
        <div className="dataset-label-editor">
          <h4>Column labels and details</h4>
          <div className="dataset-label-actions">
            <button
              className="primary"
              disabled={busy || savingColumns || !hasUnsavedColumnDetails}
              onClick={onSaveLabels}
            >
              {savingColumns ? 'Saving…' : 'Save column details'}
            </button>
            <span
              className="dataset-edit-status"
              role="status"
              aria-live="polite"
            >
              {columnSaveState === 'saving'
                ? 'Saving…'
                : hasUnsavedColumnDetails
                  ? columnSaveState === 'failed'
                    ? 'Changes not saved'
                    : 'Unsaved changes'
                  : columnSaveState === 'saved'
                    ? 'Changes saved'
                    : 'No unsaved changes'}
            </span>
          </div>
          <p className="field-help">
            Labels describe your imported columns. Changing a label, meaning, or
            unit does not change the original values.
          </p>
          <div className="dataset-column-metadata">
            {columns.map((column) => (
              <fieldset key={column.id}>
                <legend>
                  {column.originalName || `Column ${column.ordinal + 1}`}
                </legend>
                <label>
                  Display label
                  <input
                    value={labels[column.id] ?? column.label}
                    maxLength={120}
                    disabled={
                      busy || savingColumns || columnSaveState === 'saving'
                    }
                    onChange={(event) =>
                      setLabels({ ...labels, [column.id]: event.target.value })
                    }
                  />
                </label>
                {column.type === 'number' ? (
                  <>
                    <label>
                      Meaning
                      <input
                        value={columnMetadata[column.id]?.meaning ?? ''}
                        maxLength={120}
                        placeholder="For example: post impressions"
                        disabled={
                          busy || savingColumns || columnSaveState === 'saving'
                        }
                        onChange={(event) =>
                          setColumnMetadata({
                            ...columnMetadata,
                            [column.id]: {
                              meaning: event.target.value,
                              unit: columnMetadata[column.id]?.unit ?? '',
                            },
                          })
                        }
                      />
                    </label>
                    <label>
                      Unit
                      <input
                        value={columnMetadata[column.id]?.unit ?? ''}
                        maxLength={40}
                        placeholder="For example: impressions"
                        disabled={
                          busy || savingColumns || columnSaveState === 'saving'
                        }
                        onChange={(event) =>
                          setColumnMetadata({
                            ...columnMetadata,
                            [column.id]: {
                              meaning: columnMetadata[column.id]?.meaning ?? '',
                              unit: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </>
                ) : null}
              </fieldset>
            ))}
          </div>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={onSaveTemplate}
            >
              Save labels as template
            </button>
          </div>
        </div>
      ) : null}
      <div className="filters dataset-filters" aria-label="Dataset filters">
        <label>
          Search rows
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this dataset"
          />
        </label>
        {dateColumns.length ? (
          <>
            <label>
              Date column
              <select
                value={dateColumnId}
                onChange={(event) => setDateColumnId(event.target.value)}
              >
                {dateColumns.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              To
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        ) : null}
        {numericColumns.length ? (
          <label>
            Optional chart
            <select
              value={chartColumnId}
              onChange={(event) => setChartColumnId(event.target.value)}
            >
              {numericColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {chartData.length ? (
        <div
          className="dataset-chart"
          role="img"
          aria-label={`Chart of ${numericColumns.find((column) => column.id === chartColumnId)?.label ?? 'selected values'} by ${chartData[0]?.date !== undefined ? 'date' : 'source row'}`}
        >
          <p className="field-help">
            Each point is one imported row from the current page. Repeated dates
            and values are not combined.
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ left: 36, bottom: 18 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={
                  chartData[0]?.date !== undefined ? 'date' : 'sourceRow'
                }
                height={60}
                minTickGap={30}
                label={{
                  value:
                    chartData[0]?.date !== undefined ? 'Date' : 'Source row',
                  position: 'insideBottom',
                  offset: -8,
                }}
              />
              <YAxis
                label={{
                  value:
                    numericColumns.find((column) => column.id === chartColumnId)
                      ?.label ?? 'Value',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />
              <Legend height={30} />
              <Tooltip
                formatter={(_value, _name, item) => [
                  item.payload.exactValue,
                  numericColumns.find((column) => column.id === chartColumnId)
                    ?.label ?? 'Value',
                ]}
              />
              <Bar
                dataKey="value"
                name={
                  numericColumns.find((column) => column.id === chartColumnId)
                    ?.label ?? 'Value'
                }
                fill="#2764e7"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}
      {rows ? (
        <details
          className="dataset-source-rows"
          open={sourceRowsOpen}
          onToggle={(event) => setSourceRowsOpen(event.currentTarget.open)}
        >
          <summary>View source rows</summary>
          <p className="muted-text">
            {rows.totalRows} matching rows · page {rows.page} of{' '}
            {Math.max(1, rows.totalPages)}
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Dataset rows and columns"
          >
            <table aria-label="Dataset rows and columns">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.id}
                      title={`Original header: ${column.originalName || '(blank)'}`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.rows.map((row) => (
                  <tr key={row.id}>
                    {columns.map((column) => (
                      <td key={column.id}>
                        {rawCell(row.cells[column.ordinal])}
                      </td>
                    ))}
                  </tr>
                ))}
                {!rows.rows.length ? (
                  <tr>
                    <td colSpan={columns.length || 1}>
                      No rows match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="dataset-pagination">
            <span>
              Showing rows{' '}
              {rows.totalRows ? (rows.page - 1) * rows.pageSize + 1 : 0}–
              {Math.min(rows.page * rows.pageSize, rows.totalRows)} of{' '}
              {rows.totalRows}
            </span>
            <div className="button-row">
              <button
                className="secondary"
                disabled={rows.page <= 1 || busy}
                onClick={() => onPage(rows.page - 1)}
              >
                Previous
              </button>
              <button
                className="secondary"
                disabled={rows.page >= rows.totalPages || busy}
                onClick={() => onPage(rows.page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </details>
      ) : loading ? (
        <p role="status">Loading rows…</p>
      ) : null}
      <div className="button-row dataset-export-actions">
        <button type="button" className="secondary" onClick={onBack}>
          ← Back to campaign files
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => onExport('csv')}
        >
          Export filtered rows as CSV
        </button>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => onExport('pdf')}
        >
          Export dataset as PDF
        </button>
      </div>
    </section>
  );
}

function HistoricalViewer({
  item,
  result,
  loading,
  error,
  page,
  setPage,
  onBack,
}: {
  item: HistoricalImport;
  result: DatasetHistoryDetail | null;
  loading: boolean;
  error: unknown;
  page: number;
  setPage: (page: number) => void;
  onBack: () => void;
}) {
  return (
    <section className="panel dataset-viewer">
      <button className="secondary" onClick={onBack}>
        ← Back to campaign data
      </button>
      <p className="eyebrow">Earlier import · viewing only</p>
      <h3>{item.name}</h3>
      <p className="notice">{item.note}</p>
      {loading ? <p role="status">Loading records…</p> : null}
      {error ? (
        <p className="notice error" role="alert">
          {error instanceof Error
            ? error.message
            : 'Records could not be loaded.'}
        </p>
      ) : null}
      {result ? (
        <>
          <p className="muted-text">
            {result.totalRecords} available campaign records
          </p>
          <div
            className="table-scroll"
            tabIndex={0}
            aria-label="Current records linked to an earlier import"
          >
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Channel</th>
                  <th>Platform</th>
                  <th>Values still available</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.date}</td>
                    <td>{row.channel}</td>
                    <td>{row.platform}</td>
                    <td>
                      {row.values
                        .map((value) => `${value.name}: ${value.value}`)
                        .join(' · ') || 'No values remain'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="dataset-pagination">
            <span>
              Page {page} of {Math.max(1, result.totalPages)}
            </span>
            <button
              className="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="secondary"
              disabled={page >= result.totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
    </section>
  );
}
