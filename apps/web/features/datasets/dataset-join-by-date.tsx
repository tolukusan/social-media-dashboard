'use client';

import { useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useQueries } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import { printJoinedDataset } from './joined-dataset-print';
import type {
  DatasetCard,
  DatasetDetail,
  DatasetRowsResult,
} from '../../lib/workspace-types';

type LoadedDataset = { detail: DatasetDetail; rows: DatasetRowsResult['rows'] };
type SourceChoice = {
  datasetId: string;
  dateColumnId: string;
  valueColumnId: string;
};
type JoinedRow = {
  date: string;
  occurrence: number;
  values: string[];
  numericValues: Array<number | null>;
};

const PAGE_SIZE = 200;
const MAX_ROWS_PER_SOURCE = 10_000;
const PREVIEW_PAGE_SIZE = 25;

function displayCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const cell = value as Record<string, unknown>;
  if (cell.$cell === 'number' || cell.$cell === 'date')
    return String(cell.displayText ?? cell.raw ?? cell.iso ?? '');
  if (cell.$cell === 'richText' || cell.$cell === 'hyperlink')
    return String(cell.text ?? '');
  if (cell.$cell === 'formula') {
    const cached = displayCell(cell.cachedValue);
    return cached || String(cell.formula ?? 'Formula');
  }
  if (cell.$cell === 'error')
    return `Spreadsheet error: ${String(cell.value ?? '')}`;
  return JSON.stringify(value);
}

function normalizedDate(value: unknown): string | null {
  const text = String(value ?? '').trim();
  if (!text) return null;
  // Preserve exported text dates instead of guessing their day/month order.
  return /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text) ? text.slice(0, 10) : text;
}

async function loadDataset(id: string): Promise<LoadedDataset> {
  const detail = await apiRequest<DatasetDetail>(`/datasets/${id}`);
  if (detail.rowCount > MAX_ROWS_PER_SOURCE) {
    throw new Error(
      `“${detail.name}” has ${detail.rowCount.toLocaleString()} rows. The date join is limited to ${MAX_ROWS_PER_SOURCE.toLocaleString()} rows per file.`,
    );
  }
  const first = await apiRequest<DatasetRowsResult>(
    `/datasets/${id}/rows?page=1&pageSize=${PAGE_SIZE}&expectedRevision=${detail.currentRevision}`,
  );
  const rows = [...first.rows];
  for (let page = 2; page <= first.totalPages; page += 1) {
    const next = await apiRequest<DatasetRowsResult>(
      `/datasets/${id}/rows?page=${page}&pageSize=${PAGE_SIZE}&expectedRevision=${detail.currentRevision}`,
    );
    rows.push(...next.rows);
  }
  return { detail, rows };
}

function quoteCsv(value: string): string {
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function DatasetJoinByDate({
  datasets,
  defaultOpen = false,
}: {
  datasets: DatasetCard[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [sourceIds, setSourceIds] = useState(() =>
    datasets.slice(0, Math.min(3, datasets.length)).map((item) => item.id),
  );
  const [choices, setChoices] = useState<Record<string, SourceChoice>>({});
  const [page, setPage] = useState(1);
  const [chartSourceId, setChartSourceId] = useState('');
  const [printError, setPrintError] = useState('');
  const chartRef = useRef<HTMLDivElement>(null);
  const sourceQueries = useQueries({
    queries: sourceIds
      .filter((id) => datasets.some((dataset) => dataset.id === id))
      .map((datasetId) => ({
        queryKey: ['dataset-join-source', datasetId],
        enabled: isOpen,
        queryFn: () => loadDataset(datasetId),
      })),
  });

  const sources = sourceQueries.flatMap((query, index) => {
    const loaded = query.data;
    if (!loaded) return [];
    const dateColumns = loaded.detail.columns;
    const defaultDateColumn =
      dateColumns.find((column) => column.type === 'date') ??
      dateColumns.find(
        (column) =>
          /^date$/i.test(column.originalName.trim()) ||
          /^date$/i.test(column.label.trim()),
      );
    const choice = choices[loaded.detail.id];
    const dateColumnId = dateColumns.some(
      (column) => column.id === choice?.dateColumnId,
    )
      ? choice!.dateColumnId
      : (defaultDateColumn?.id ?? dateColumns[0]?.id ?? '');
    const valueColumns = loaded.detail.columns.filter(
      (column) => column.id !== dateColumnId,
    );
    const valueColumnId = valueColumns.some(
      (column) => column.id === choice?.valueColumnId,
    )
      ? choice!.valueColumnId
      : (valueColumns[0]?.id ?? '');
    return [
      {
        dataset: loaded.detail,
        rows: loaded.rows,
        dateColumns,
        valueColumns,
        dateColumnId,
        valueColumnId,
        query: sourceQueries[index],
      },
    ];
  });

  const joinedRows = useMemo(() => {
    const rowsBySource = sources.map((source) => {
      const dateOrdinal = source.dataset.columns.find(
        (column) => column.id === source.dateColumnId,
      )?.ordinal;
      const valueOrdinal = source.dataset.columns.find(
        (column) => column.id === source.valueColumnId,
      )?.ordinal;
      const datedRows = new Map<
        string,
        Array<{ text: string; numeric: number | null }>
      >();
      if (dateOrdinal === undefined || valueOrdinal === undefined)
        return datedRows;
      for (const row of source.rows) {
        const typedDate = row.typedCells[dateOrdinal];
        const date = normalizedDate(
          typedDate?.kind === 'date'
            ? typedDate.value
            : displayCell(row.cells[dateOrdinal]),
        );
        if (!date) continue;
        const values = datedRows.get(date) ?? [];
        const typed = row.typedCells[valueOrdinal];
        const number = Number(typed?.value);
        values.push({
          text: displayCell(row.cells[valueOrdinal]),
          numeric:
            typed?.kind === 'number' &&
            Number.isFinite(number) &&
            Math.abs(number) <= Number.MAX_SAFE_INTEGER
              ? number
              : null,
        });
        datedRows.set(date, values);
      }
      return datedRows;
    });
    const dates = [
      ...new Set(rowsBySource.flatMap((rows) => [...rows.keys()])),
    ].sort((left, right) => left.localeCompare(right));
    return dates.flatMap((date) => {
      const occurrenceCount = Math.max(
        0,
        ...rowsBySource.map((rows) => rows.get(date)?.length ?? 0),
      );
      return Array.from({ length: occurrenceCount }, (_, occurrence) => ({
        date,
        occurrence,
        values: rowsBySource.map(
          (rows) => rows.get(date)?.[occurrence]?.text ?? '',
        ),
        numericValues: rowsBySource.map(
          (rows) => rows.get(date)?.[occurrence]?.numeric ?? null,
        ),
      }));
    });
  }, [sources]);

  const allLoaded =
    sourceQueries.length > 0 && sourceQueries.every((query) => query.isSuccess);
  const loading = sourceQueries.some((query) => query.isPending);
  const error = sourceQueries.find((query) => query.error)?.error;
  const maxPage = Math.max(1, Math.ceil(joinedRows.length / PREVIEW_PAGE_SIZE));
  const visibleRows = joinedRows.slice(
    (page - 1) * PREVIEW_PAGE_SIZE,
    page * PREVIEW_PAGE_SIZE,
  );
  const canAddSource = sourceIds.length < Math.min(6, datasets.length);
  const headings = [
    'Date',
    ...sources.map(
      (source) =>
        `${source.dataset.name} · ${source.dataset.columns.find((column) => column.id === source.valueColumnId)?.label ?? 'Value'}`,
    ),
  ];
  const chartSources = sources.filter(
    (source) =>
      source.dataset.columns.find(
        (column) => column.id === source.valueColumnId,
      )?.type === 'number',
  );
  const chartIndex = sources.findIndex(
    (source) =>
      source.dataset.id === chartSourceId && chartSources.includes(source),
  );
  const chartLabel = chartIndex >= 0 ? headings[chartIndex + 1] : '';
  const chartData =
    chartIndex < 0
      ? []
      : joinedRows.map((row) => ({
          date: row.date,
          value: row.numericValues[chartIndex],
          exactValue: row.values[chartIndex],
        }));

  const updateChoice = (datasetId: string, next: Partial<SourceChoice>) => {
    setChoices((current) => ({
      ...current,
      [datasetId]: {
        datasetId,
        dateColumnId: current[datasetId]?.dateColumnId ?? '',
        valueColumnId: current[datasetId]?.valueColumnId ?? '',
        ...next,
      },
    }));
    setPage(1);
  };

  const exportCsv = () => {
    if (!sources.length || !joinedRows.length) return;
    const csv = [
      headings.map(quoteCsv).join(','),
      ...joinedRows.map((row) =>
        [row.date, ...row.values].map(quoteCsv).join(','),
      ),
    ].join('\r\n');
    const url = URL.createObjectURL(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'datasets-joined-by-date.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  if (!datasets.length) return null;

  return (
    <details
      className="dataset-join panel"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>
        {defaultOpen ? 'Campaign data' : 'Join datasets by date'}
      </summary>
      <p className="muted-text">
        Match imported columns by date to view them in one table. Original
        imports stay separate; missing dates remain blank and repeated dates
        stay as separate rows. Dates stored as text match by their exported
        text; no day/month order is guessed.
      </p>
      <details open={!defaultOpen}>
        <summary>Configure columns</summary>
        <div className="dataset-join-sources">
          {sourceIds.map((datasetId, index) => {
            const source = sources.find(
              (item) => item.dataset.id === datasetId,
            );
            const choice = source
              ? {
                  dateColumnId: source.dateColumnId,
                  valueColumnId: source.valueColumnId,
                }
              : choices[datasetId];
            return (
              <fieldset key={`${datasetId}-${index}`}>
                <legend>Source {index + 1}</legend>
                <label>
                  Dataset
                  <select
                    aria-label={`Dataset ${index + 1}`}
                    value={datasetId}
                    onChange={(event) => {
                      setSourceIds((current) =>
                        current.map((id, position) =>
                          position === index ? event.target.value : id,
                        ),
                      );
                      setPage(1);
                    }}
                  >
                    {datasets
                      .filter(
                        (item) =>
                          item.id === datasetId || !sourceIds.includes(item.id),
                      )
                      .map((dataset) => (
                        <option key={dataset.id} value={dataset.id}>
                          {dataset.name}
                        </option>
                      ))}
                  </select>
                </label>
                {source ? (
                  <>
                    <label>
                      Date column
                      <select
                        aria-label={`Date column ${index + 1}`}
                        value={choice?.dateColumnId ?? ''}
                        onChange={(event) =>
                          updateChoice(datasetId, {
                            dateColumnId: event.target.value,
                          })
                        }
                      >
                        {source.dateColumns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Value column
                      <select
                        aria-label={`Value column ${index + 1}`}
                        value={choice?.valueColumnId ?? ''}
                        onChange={(event) =>
                          updateChoice(datasetId, {
                            valueColumnId: event.target.value,
                          })
                        }
                      >
                        {source.valueColumns.map((column) => (
                          <option key={column.id} value={column.id}>
                            {column.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : null}
                {sourceIds.length > 2 ? (
                  <button
                    type="button"
                    className="secondary danger"
                    aria-label={`Remove source ${index + 1}`}
                    onClick={() => {
                      setSourceIds((current) =>
                        current.filter((_id, position) => position !== index),
                      );
                      setPage(1);
                    }}
                  >
                    Remove source
                  </button>
                ) : null}
              </fieldset>
            );
          })}
        </div>
        {canAddSource ? (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              const next = datasets.find(
                (item) => !sourceIds.includes(item.id),
              );
              if (next) setSourceIds((current) => [...current, next.id]);
            }}
          >
            Add dataset
          </button>
        ) : null}
      </details>
      {error ? (
        <p className="notice error" role="alert">
          {error instanceof Error
            ? error.message
            : 'The datasets could not be joined.'}
        </p>
      ) : null}
      {loading ? <p role="status">Loading source rows…</p> : null}
      {allLoaded ? (
        <>
          {sources.some(
            (source) =>
              !source.dateColumns.length || !source.valueColumns.length,
          ) ? (
            <p className="notice">
              Each source needs at least one date column and one value column to
              join.
            </p>
          ) : joinedRows.length ? (
            <>
              <div className="dataset-join-actions">
                <p role="status">
                  {joinedRows.length.toLocaleString()} joined rows · matched by
                  date
                </p>
                <button type="button" className="secondary" onClick={exportCsv}>
                  Download joined CSV
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setPrintError('');
                    const opened = printJoinedDataset({
                      title: `${sources[0].dataset.campaign.name} — Campaign data`,
                      headings,
                      rows: joinedRows.map((row) => [row.date, ...row.values]),
                      chartSvg:
                        chartIndex >= 0
                          ? chartRef.current?.querySelector('svg')?.outerHTML
                          : undefined,
                    });
                    if (!opened)
                      setPrintError(
                        'Allow pop-ups for this app to open the printable report.',
                      );
                  }}
                >
                  Print / Save PDF
                </button>
              </div>
              {printError ? (
                <p className="notice error" role="alert">
                  {printError}
                </p>
              ) : null}
              {chartSources.length ? (
                <label className="form-field dataset-join-chart-picker">
                  Chart by date
                  <select
                    value={chartIndex >= 0 ? chartSourceId : ''}
                    onChange={(event) => setChartSourceId(event.target.value)}
                  >
                    <option value="">No chart</option>
                    {chartSources.map((source) => (
                      <option key={source.dataset.id} value={source.dataset.id}>
                        {headings[sources.indexOf(source) + 1]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {chartIndex >= 0 ? (
                <section aria-label={`${chartLabel} by date`}>
                  <h4>{chartLabel} by date</h4>
                  <p className="field-help">
                    All {joinedRows.length.toLocaleString()} joined rows.
                    Missing values create gaps; repeated dates remain separate
                    points.
                  </p>
                  <div
                    ref={chartRef}
                    className="dataset-joined-chart"
                    role="img"
                    aria-label={`Chart of ${chartLabel} by date`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ left: 24, right: 20, top: 16, bottom: 12 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          minTickGap={40}
                          height={60}
                          label={{
                            value: 'Date',
                            position: 'insideBottom',
                            offset: 0,
                          }}
                        />
                        <YAxis width={70} />
                        <Legend height={30} />
                        <Tooltip
                          formatter={(_value, _name, item) => [
                            item.payload.exactValue,
                            chartLabel,
                          ]}
                        />
                        <Line
                          type="linear"
                          dataKey="value"
                          name={chartLabel}
                          stroke="#1d4ed8"
                          strokeWidth={2}
                          dot={joinedRows.length < 100}
                          connectNulls={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              ) : null}
              <div
                className="table-scroll"
                tabIndex={0}
                aria-label="Joined dataset rows"
              >
                <table aria-label="Datasets joined by date">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      {sources.map((source) => (
                        <th key={source.dataset.id} scope="col">
                          {source.dataset.name} ·{' '}
                          {source.dataset.columns.find(
                            (column) => column.id === source.valueColumnId,
                          )?.label ?? 'Value'}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={`${row.date}-${row.occurrence}`}>
                        <td>{row.date}</td>
                        {row.values.map((value, index) => (
                          <td key={`${sourceIds[index]}-${index}`}>
                            {value || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="dataset-pagination">
                <span>
                  Page {page} of {maxPage}
                </span>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={page >= maxPage}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : (
            <p className="notice">
              No dated rows were found in the selected sources.
            </p>
          )}
        </>
      ) : null}
    </details>
  );
}
