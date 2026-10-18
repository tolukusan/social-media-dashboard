'use client';

import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, apiResponse } from '../../lib/api-client';
import type {
  DatasetCard,
  DatasetComparisonResult,
  DatasetDetail,
  DatasetRowsResult,
} from '../../lib/workspace-types';

function displayCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  const cell = value as Record<string, unknown>;
  if (cell.$cell === 'number')
    return String(cell.displayText ?? cell.raw ?? '');
  if (cell.$cell === 'date') return String(cell.displayText ?? cell.iso ?? '');
  if (cell.$cell === 'richText' || cell.$cell === 'hyperlink')
    return String(cell.text ?? '');
  if (cell.$cell === 'formula') {
    const cached: string = displayCell(cell.cachedValue);
    return cached ? `${cached} (formula)` : String(cell.formula ?? 'Formula');
  }
  if (cell.$cell === 'error')
    return `Spreadsheet error: ${String(cell.value ?? '')}`;
  return JSON.stringify(value);
}

function series(
  rows: DatasetRowsResult | undefined,
  dateOrdinal: number | null,
  valueOrdinal: number,
) {
  if (!rows || dateOrdinal === null) return [];
  return rows.rows.flatMap((row) => {
    const dateCell = row.typedCells[dateOrdinal];
    const date = Date.parse(String(dateCell?.value ?? ''));
    const typed = row.typedCells[valueOrdinal];
    const value = Number(typed?.value);
    if (
      !Number.isFinite(date) ||
      dateCell?.kind !== 'date' ||
      typed?.kind !== 'number' ||
      !Number.isFinite(value) ||
      Math.abs(value) > Number.MAX_SAFE_INTEGER
    )
      return [];
    return [
      {
        date,
        value,
        exactValue: displayCell(row.cells[valueOrdinal]),
        sourceRow: row.sourceRowNumber,
      },
    ];
  });
}

function DatasetTable({
  title,
  detail,
  rows,
  columnId,
  dateColumnId,
}: {
  title: string;
  detail: DatasetDetail | undefined;
  rows: DatasetRowsResult | undefined;
  columnId: string;
  dateColumnId: string;
}) {
  const selectedColumn = detail?.columns.find(
    (column) => column.id === columnId,
  );
  const dateOrdinal = detail?.columns.find(
    (column) => column.id === dateColumnId,
  )?.ordinal;
  return (
    <section className="dataset-comparison-side">
      <h4>{title}</h4>
      <p className="muted-text">
        {detail?.name ?? 'Loading dataset…'} ·{' '}
        {selectedColumn?.label ?? 'Select a column'}
      </p>
      <div
        className="table-scroll"
        tabIndex={0}
        aria-label={`${title} comparison rows`}
      >
        <table aria-label={`${title} comparison rows`}>
          <thead>
            <tr>
              <th>Source row</th>
              <th>Date</th>
              <th>{selectedColumn?.label ?? 'Value'}</th>
            </tr>
          </thead>
          <tbody>
            {rows?.rows.map((row) => (
              <tr key={row.id}>
                <td>{row.sourceRowNumber}</td>
                <td>
                  {dateOrdinal === undefined
                    ? ''
                    : displayCell(row.cells[dateOrdinal])}
                </td>
                <td>
                  {selectedColumn
                    ? displayCell(row.cells[selectedColumn.ordinal])
                    : ''}
                </td>
              </tr>
            ))}
            {!rows?.rows.length ? (
              <tr>
                <td colSpan={3}>No rows to show.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {rows ? (
        <p className="muted-text">
          Page {rows.page} of {Math.max(1, rows.totalPages)} · {rows.totalRows}{' '}
          rows
        </p>
      ) : null}
    </section>
  );
}

export function DatasetComparison({
  campaignId,
  datasets,
}: {
  campaignId: string;
  datasets: DatasetCard[];
}) {
  const [leftDatasetId, setLeftDatasetId] = useState('');
  const [rightDatasetId, setRightDatasetId] = useState('');
  const [leftColumnId, setLeftColumnId] = useState('');
  const [rightColumnId, setRightColumnId] = useState('');
  const [leftDateColumnId, setLeftDateColumnId] = useState('');
  const [rightDateColumnId, setRightDateColumnId] = useState('');
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  useEffect(() => {
    if (!datasets.length) return;
    setLeftDatasetId((current) =>
      datasets.some((item) => item.id === current) ? current : datasets[0]!.id,
    );
    setRightDatasetId((current) =>
      datasets.some((item) => item.id === current)
        ? current
        : (datasets[1] ?? datasets[0])!.id,
    );
  }, [datasets]);
  const leftDetailQuery = useQuery({
    queryKey: ['dataset', leftDatasetId],
    enabled: Boolean(isOpen && leftDatasetId),
    queryFn: () => apiRequest<DatasetDetail>(`/datasets/${leftDatasetId}`),
  });
  const rightDetailQuery = useQuery({
    queryKey: ['dataset', rightDatasetId],
    enabled: Boolean(isOpen && rightDatasetId),
    queryFn: () => apiRequest<DatasetDetail>(`/datasets/${rightDatasetId}`),
  });
  const leftDetail = leftDetailQuery.data;
  const rightDetail = rightDetailQuery.data;
  const leftNumericColumns =
    leftDetail?.columns.filter((column) => column.type === 'number') ?? [];
  const rightNumericColumns =
    rightDetail?.columns.filter((column) => column.type === 'number') ?? [];
  const leftDates =
    leftDetail?.columns.filter((column) => column.type === 'date') ?? [];
  const rightDates =
    rightDetail?.columns.filter((column) => column.type === 'date') ?? [];
  useEffect(() => {
    if (leftDetail) {
      setLeftColumnId((current) =>
        leftNumericColumns.some((column) => column.id === current)
          ? current
          : (leftNumericColumns[0]?.id ?? ''),
      );
      setLeftDateColumnId((current) =>
        leftDates.some((column) => column.id === current)
          ? current
          : (leftDates[0]?.id ?? ''),
      );
    }
  }, [leftDetail?.id, leftDetail?.currentRevision]);
  useEffect(() => {
    if (rightDetail) {
      setRightColumnId((current) =>
        rightNumericColumns.some((column) => column.id === current)
          ? current
          : (rightNumericColumns[0]?.id ?? ''),
      );
      setRightDateColumnId((current) =>
        rightDates.some((column) => column.id === current)
          ? current
          : (rightDates[0]?.id ?? ''),
      );
    }
  }, [rightDetail?.id, rightDetail?.currentRevision]);
  const comparisonQuery = useQuery({
    queryKey: [
      'dataset-comparison',
      campaignId,
      leftDatasetId,
      leftColumnId,
      leftDateColumnId,
      rightDatasetId,
      rightColumnId,
      rightDateColumnId,
    ],
    enabled: Boolean(
      leftDatasetId &&
      isOpen &&
      rightDatasetId &&
      leftColumnId &&
      rightColumnId &&
      leftDetail &&
      rightDetail &&
      (leftDatasetId !== rightDatasetId || leftColumnId !== rightColumnId),
    ),
    queryFn: () =>
      apiRequest<DatasetComparisonResult>('/datasets/compare/compatibility', {
        method: 'POST',
        body: {
          leftDatasetId,
          leftColumnId,
          ...(leftDateColumnId ? { leftDateColumnId } : {}),
          ...(leftDetail
            ? { leftExpectedRevision: leftDetail.currentRevision }
            : {}),
          rightDatasetId,
          rightColumnId,
          ...(rightDateColumnId ? { rightDateColumnId } : {}),
          ...(rightDetail
            ? { rightExpectedRevision: rightDetail.currentRevision }
            : {}),
        },
      }),
  });
  const leftRowsQuery = useQuery({
    queryKey: [
      'dataset-comparison-rows',
      leftDatasetId,
      leftDetail?.currentRevision,
      page,
    ],
    enabled: Boolean(isOpen && leftDatasetId && leftColumnId && leftDetail),
    queryFn: () =>
      apiRequest<DatasetRowsResult>(
        `/datasets/${leftDatasetId}/rows?page=${page}&pageSize=25&expectedRevision=${leftDetail!.currentRevision}`,
      ),
  });
  const rightRowsQuery = useQuery({
    queryKey: [
      'dataset-comparison-rows',
      rightDatasetId,
      rightDetail?.currentRevision,
      page,
    ],
    enabled: Boolean(isOpen && rightDatasetId && rightColumnId && rightDetail),
    queryFn: () =>
      apiRequest<DatasetRowsResult>(
        `/datasets/${rightDatasetId}/rows?page=${page}&pageSize=25&expectedRevision=${rightDetail!.currentRevision}`,
      ),
  });
  const comparison = comparisonQuery.data;
  const leftChartData = useMemo(() => {
    const ordinal = leftDetail?.columns.find(
      (column) => column.id === leftColumnId,
    )?.ordinal;
    const dateOrdinal = leftDetail?.columns.find(
      (column) => column.id === leftDateColumnId,
    )?.ordinal;
    return ordinal === undefined
      ? []
      : series(leftRowsQuery.data, dateOrdinal ?? null, ordinal);
  }, [leftColumnId, leftDateColumnId, leftDetail, leftRowsQuery.data]);
  const rightChartData = useMemo(() => {
    const ordinal = rightDetail?.columns.find(
      (column) => column.id === rightColumnId,
    )?.ordinal;
    const dateOrdinal = rightDetail?.columns.find(
      (column) => column.id === rightDateColumnId,
    )?.ordinal;
    return ordinal === undefined
      ? []
      : series(rightRowsQuery.data, dateOrdinal ?? null, ordinal);
  }, [rightColumnId, rightDateColumnId, rightDetail, rightRowsQuery.data]);
  const maxPages = Math.max(
    leftRowsQuery.data?.totalPages ?? 1,
    rightRowsQuery.data?.totalPages ?? 1,
  );
  const exportComparison = async () => {
    if (!comparison) return;
    setExporting(true);
    setExportError('');
    try {
      const response = await apiResponse('/datasets/compare/export.pdf', {
        method: 'POST',
        body: {
          leftDatasetId,
          leftColumnId,
          ...(leftDateColumnId ? { leftDateColumnId } : {}),
          leftExpectedRevision: comparison.left.revision,
          rightDatasetId,
          rightColumnId,
          ...(rightDateColumnId ? { rightDateColumnId } : {}),
          rightExpectedRevision: comparison.right.revision,
        },
      });
      const blob = await response.blob();
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'dataset-comparison.pdf';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      setExportError(
        cause instanceof Error
          ? cause.message
          : 'The comparison could not be exported.',
      );
    } finally {
      setExporting(false);
    }
  };

  if (!datasets.length) return null;
  return (
    <details
      className="dataset-comparison panel"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary>Compare two columns</summary>
      <p className="muted-text">
        Compare original numeric values from this campaign. Each side keeps its
        own rows; no totals or rates are calculated.
      </p>
      <div className="dataset-comparison-controls">
        <fieldset>
          <legend>First column</legend>
          <label>
            Dataset
            <select
              value={leftDatasetId}
              onChange={(event) => {
                setLeftDatasetId(event.target.value);
                setPage(1);
              }}
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Numeric column
            <select
              value={leftColumnId}
              onChange={(event) => setLeftColumnId(event.target.value)}
            >
              {leftNumericColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          {leftDates.length ? (
            <label>
              Date column
              <select
                value={leftDateColumnId}
                onChange={(event) => setLeftDateColumnId(event.target.value)}
              >
                <option value="">No date field</option>
                {leftDates.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>
        <fieldset>
          <legend>Second column</legend>
          <label>
            Dataset
            <select
              value={rightDatasetId}
              onChange={(event) => {
                setRightDatasetId(event.target.value);
                setPage(1);
              }}
            >
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Numeric column
            <select
              value={rightColumnId}
              onChange={(event) => setRightColumnId(event.target.value)}
            >
              {rightNumericColumns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          {rightDates.length ? (
            <label>
              Date column
              <select
                value={rightDateColumnId}
                onChange={(event) => setRightDateColumnId(event.target.value)}
              >
                <option value="">No date field</option>
                {rightDates.map((column) => (
                  <option key={column.id} value={column.id}>
                    {column.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>
      </div>
      {comparisonQuery.error ? (
        <p className="notice error" role="alert">
          {comparisonQuery.error instanceof Error
            ? comparisonQuery.error.message
            : 'The columns could not be compared.'}
        </p>
      ) : null}
      {comparison?.chart.eligible ? (
        <div
          className="dataset-chart dataset-shared-chart"
          role="img"
          aria-label="Shared time-series chart of selected source values"
        >
          <p className="field-help">
            A shared chart is available because both columns have matching
            meanings and units, and their dated observations use the same
            interval. The chart shows this page only; no values are combined.
          </p>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="date"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(value: number) =>
                  new Date(value).toISOString().slice(0, 10)
                }
                name="Date"
              />
              <YAxis type="number" dataKey="value" name="Value" />
              <Legend />
              <Tooltip
                formatter={(_value, _name, item) => [
                  item.payload.exactValue,
                  `Source row ${item.payload.sourceRow}`,
                ]}
                labelFormatter={(value) =>
                  new Date(Number(value)).toISOString().slice(0, 10)
                }
              />
              <Scatter
                name={`${comparison.left.datasetName}: ${comparison.left.columnLabel}`}
                data={leftChartData}
                fill="#2764e7"
                line
              />
              <Scatter
                name={`${comparison.right.datasetName}: ${comparison.right.columnLabel}`}
                data={rightChartData}
                fill="#12a594"
                line
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      ) : comparison ? (
        <p className="notice">
          {comparison.chart.reason} The two columns remain available side by
          side.
        </p>
      ) : null}
      {comparison ? (
        <div className="button-row dataset-export-actions">
          <button
            className="secondary"
            disabled={exporting}
            onClick={() => void exportComparison()}
          >
            {exporting ? 'Exporting…' : 'Export comparison PDF'}
          </button>
        </div>
      ) : null}
      {exportError ? (
        <p className="notice error" role="alert">
          {exportError}
        </p>
      ) : null}
      <div className="dataset-comparison-tables">
        <DatasetTable
          title="First dataset"
          detail={leftDetail}
          rows={leftRowsQuery.data}
          columnId={leftColumnId}
          dateColumnId={leftDateColumnId}
        />
        <DatasetTable
          title="Second dataset"
          detail={rightDetail}
          rows={rightRowsQuery.data}
          columnId={rightColumnId}
          dateColumnId={rightDateColumnId}
        />
      </div>
      <div className="dataset-pagination">
        <span>
          Showing page {page} of {Math.max(1, maxPages)} for each dataset.
        </span>
        <div className="button-row">
          <button
            className="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <button
            className="secondary"
            disabled={page >= maxPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </details>
  );
}
