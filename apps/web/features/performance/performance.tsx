'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Empty } from '../../components/empty';
import type {
  Campaign,
  ChannelMetric,
  CurrentUser,
  PerformanceRecord,
} from '../../lib/workspace-types';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest, invalidateWorkspace } from '../../lib/api-client';

type PerformanceContext = {
  id: string;
  channelId: string;
  campaignName: string;
  channelName: string;
  platformName: string;
  campaign: Campaign;
};

export function Performance({
  records,
  campaigns,
  currentUser,
}: {
  records: PerformanceRecord[];
  campaigns: Campaign[];
  currentUser: CurrentUser | null;
}) {
  const queryClient = useQueryClient();
  const canWrite = ['ADMIN', 'MARKETING_OFFICER'].includes(
    currentUser?.role.code ?? '',
  );
  const canArchive = currentUser?.role.code === 'ADMIN';
  const contexts = useMemo<PerformanceContext[]>(
    () =>
      campaigns.flatMap((campaign) =>
        (campaign.campaignChannels ?? []).flatMap((campaignChannel) =>
          (campaignChannel.campaignPlatforms ?? []).flatMap((link) => {
            if (!link.id || !campaignChannel.channel.id || !link.platform.id)
              return [];
            if (
              campaign.archivedAt ||
              campaignChannel.channel.active === false ||
              link.platform.active === false
            )
              return [];
            return [
              {
                id: link.id,
                channelId: campaignChannel.channel.id,
                campaignName: campaign.name,
                channelName: campaignChannel.channel.name,
                platformName: link.platform.name,
                campaign,
              },
            ];
          }),
        ),
      ),
    [campaigns],
  );
  const [contextId, setContextId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [recordDate, setRecordDate] = useState('');
  const [notes, setNotes] = useState('');
  const [metrics, setMetrics] = useState<ChannelMetric[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<PerformanceRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const selectedContext = contexts.find((context) => context.id === contextId);
  const editingContext = editing
    ? {
        channelId: editing.campaignPlatform?.campaignChannel?.channelId,
        campaignName: editing.campaignPlatform?.campaignChannel?.campaign?.name,
      }
    : undefined;
  const channelId = selectedContext?.channelId ?? editingContext?.channelId;
  const today = new Date().toISOString().slice(0, 10);
  const contextStart =
    selectedContext?.campaign.startDate?.slice(0, 10) ??
    editing?.campaignPlatform?.campaignChannel?.campaign?.startDate?.slice(
      0,
      10,
    );
  const contextEnd =
    selectedContext?.campaign.endDate?.slice(0, 10) ??
    editing?.campaignPlatform?.campaignChannel?.campaign?.endDate?.slice(0, 10);
  const maxRecordDate = contextEnd && contextEnd < today ? contextEnd : today;

  useEffect(() => {
    let active = true;
    setMetrics([]);
    if (!channelId) return;
    void apiRequest<ChannelMetric[]>(`/channels/${channelId}/metrics`)
      .then((result) => {
        if (active)
          setMetrics(
            result.filter(
              (metric) => metric.kind === 'RAW' && metric.inputEnabled,
            ),
          );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Applicable metrics could not be loaded.',
          );
      });
    return () => {
      active = false;
    };
  }, [channelId]);

  const resetForm = () => {
    setEditing(null);
    setContextId('');
    setRecordDate('');
    setNotes('');
    setValues({});
    setMetrics([]);
    setError('');
    setShowForm(false);
  };
  const beginEdit = (record: PerformanceRecord) => {
    setError('');
    setMessage('');
    setEditing(record);
    setShowForm(true);
    setContextId(record.campaignPlatform?.id ?? '');
    setRecordDate(record.recordDate.slice(0, 10));
    setNotes(record.notes ?? '');
    setValues(
      Object.fromEntries(
        (record.metricValues ?? []).map((metric) => [
          metric.metricDefinition?.code ?? '',
          String(metric.value),
        ]),
      ),
    );
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const context = selectedContext;
    if (!editing && !context) return;
    setBusy(true);
    setError('');
    setMessage('');
    const rawValues = Object.fromEntries(
      Object.entries(values)
        .filter(([, value]) => value.trim() !== '')
        .map(([code, value]) => [code, Number(value)]),
    );
    try {
      await apiRequest(
        editing ? `/performance-records/${editing.id}` : '/performance-records',
        {
          method: editing ? 'PATCH' : 'POST',
          body: editing
            ? { recordDate, notes, values: rawValues }
            : {
                campaignPlatformId: context!.id,
                recordDate,
                notes,
                values: rawValues,
              },
        },
      );
      await invalidateWorkspace(queryClient);
      setMessage(
        editing ? 'Performance record updated.' : 'Performance record added.',
      );
      resetForm();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Performance record could not be saved.',
      );
    } finally {
      setBusy(false);
    }
  };
  const archive = async (record: PerformanceRecord) => {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/performance-records/${record.id}`, {
        method: 'DELETE',
      });
      await invalidateWorkspace(queryClient);
      setMessage('Performance record archived.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Performance record could not be archived.',
      );
    } finally {
      setBusy(false);
    }
  };
  const filteredRecords = useMemo(
    () =>
      records.filter((record) => {
        const date = record.recordDate.slice(0, 10);
        const searchable = [
          record.campaignPlatform?.campaignChannel?.campaign?.name,
          record.campaignPlatform?.campaignChannel?.channel?.name,
          record.campaignPlatform?.platform?.name,
          record.importBatch?.displayName,
          record.importBatch?.originalFilename,
          record.integrationMapping?.connection.displayName,
        ]
          .join(' ')
          .toLowerCase();
        return (
          (!search || searchable.includes(search.trim().toLowerCase())) &&
          (!from || date >= from) &&
          (!to || date <= to)
        );
      }),
    [records, search, from, to],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / 50));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * 50;
  const visibleRecords = filteredRecords.slice(pageStart, pageStart + 50);

  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <div>
          <h2>Performance data</h2>
          <p>
            Daily raw records are entered against campaign-platform context.
            Blank metrics remain missing; zero is stored as zero.
          </p>
        </div>
        {canWrite && (
          <button
            className="primary"
            onClick={() => {
              resetForm();
              setShowForm(true);
              setMessage('');
            }}
          >
            + Add record
          </button>
        )}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {canWrite && showForm && (
        <form
          className="form-grid nested-form"
          onSubmit={(event) => void save(event)}
        >
          <h3>
            {editing ? 'Edit performance record' : 'Add performance record'}
          </h3>
          {editing ? (
            <p className="field-help">
              {editingContext?.campaignName} ·{' '}
              {editing.campaignPlatform?.campaignChannel?.channel?.name} ·{' '}
              {editing.campaignPlatform?.platform?.name}. Editing replaces the
              raw metric set; leave a metric blank to clear it.
            </p>
          ) : (
            <label>
              Campaign · channel · platform
              <select
                required
                value={contextId}
                onChange={(event) => {
                  setContextId(event.target.value);
                  setValues({});
                }}
              >
                <option value="">Select campaign context</option>
                {contexts.map((context) => (
                  <option key={context.id} value={context.id}>
                    {context.campaignName} · {context.channelName} ·{' '}
                    {context.platformName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Record date
            <input
              type="date"
              required
              min={contextStart}
              max={maxRecordDate}
              value={recordDate}
              onChange={(event) => setRecordDate(event.target.value)}
            />
          </label>
          <label>
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {channelId && (
            <fieldset className="channel-selection">
              <legend>Applicable raw metrics</legend>
              {metrics.length ? (
                metrics.map((metric) => (
                  <label key={metric.id}>
                    {metric.name} <small>({metric.unit})</small>
                    <input
                      type="number"
                      min="0"
                      step={
                        metric.unit === 'COUNT' || metric.unit === 'POSITION'
                          ? '1'
                          : 'any'
                      }
                      value={values[metric.code] ?? ''}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [metric.code]: event.target.value,
                        }))
                      }
                    />
                  </label>
                ))
              ) : (
                <p className="field-help">
                  No input-enabled raw metrics are configured for this channel.
                </p>
              )}
            </fieldset>
          )}
          <span>
            <button className="primary" disabled={busy || !channelId}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add record'}
            </button>
            {editing && (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={resetForm}
              >
                Cancel
              </button>
            )}
          </span>
        </form>
      )}
      <div className="form-grid campaign-filters">
        <label>
          Search records
          <input
            aria-label="Search performance records"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Campaign, channel, platform, import"
          />
        </label>
        <label>
          From
          <input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      {filteredRecords.length ? (
        <div className="table-wrap">
          <div
            className="record-pagination"
            aria-label="Performance record pages"
          >
            <span role="status">
              Showing {pageStart + 1}–
              {Math.min(pageStart + 50, filteredRecords.length)} of{' '}
              {filteredRecords.length} records
            </span>
            <button
              className="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous records
            </button>
            <span>
              Page {currentPage} of {pageCount}
            </span>
            <button
              className="secondary"
              disabled={currentPage === pageCount}
              onClick={() => setPage(currentPage + 1)}
            >
              Next records
            </button>
          </div>
          <table>
            <caption className="sr-only">Performance record list</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Campaign</th>
                <th scope="col">Channel</th>
                <th scope="col">Platform</th>
                <th scope="col">Metrics</th>
                <th scope="col">Source</th>
                {canWrite && <th scope="col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleRecords.map((record) => (
                <tr key={record.id}>
                  <th scope="row">{record.recordDate.slice(0, 10)}</th>
                  <td>
                    {record.campaignPlatform?.campaignChannel?.campaign?.name ||
                      '—'}
                  </td>
                  <td>
                    {record.campaignPlatform?.campaignChannel?.channel?.name ||
                      '—'}
                  </td>
                  <td>{record.campaignPlatform?.platform?.name || '—'}</td>
                  <td>
                    {record.metricValues?.length
                      ? record.metricValues
                          .map(
                            (metric) =>
                              `${metric.metricDefinition?.name ?? metric.metricDefinition?.code}: ${metric.value}`,
                          )
                          .join(', ')
                      : '—'}
                  </td>
                  <td>
                    {record.importBatch?.displayName ||
                      record.importBatch?.originalFilename ||
                      (record.integrationMapping
                        ? `${record.integrationMapping.connection.displayName}${record.integrationManaged ? '' : ' (edited manually)'}`
                        : '') ||
                      'Manual'}
                  </td>
                  {canWrite && (
                    <td>
                      <button
                        className="secondary"
                        onClick={() => beginEdit(record)}
                      >
                        Edit
                      </button>
                      {canArchive && (
                        <button
                          className="secondary danger"
                          disabled={busy}
                          onClick={() => void archive(record)}
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={
            records.length ? 'No matching records' : 'No performance records'
          }
          detail={
            records.length
              ? 'Adjust the search or date filters.'
              : 'Add a daily raw record to populate analytics.'
          }
        />
      )}
    </section>
  );
}
