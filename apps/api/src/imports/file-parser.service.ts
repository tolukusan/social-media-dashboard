import { BadRequestException, Injectable } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import type {
  ImportCell,
  ParsedImportFile,
  ParsedImportRow,
} from './import.types.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function decodeCsv(buffer: Uint8Array) {
  const utf16 = buffer[0] === 0xff || buffer[1] === 0xfe || buffer.includes(0);
  return utf16
    ? new TextDecoder('utf-16le').decode(buffer)
    : new TextDecoder('utf-8').decode(buffer);
}

function usableHeader(line: string) {
  const lower = line.toLowerCase();
  return (
    (lower.includes('date') &&
      (lower.includes('primary') ||
        lower.includes('views') ||
        lower.includes('reach'))) ||
    lower.includes('campaign name') ||
    lower.includes('sent,')
  );
}

function parseCsvRows(buffer: Uint8Array): ParsedImportFile {
  const text = decodeCsv(buffer).replace(/^\ufeff/, '');
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex(usableHeader);
  if (headerIndex < 0)
    throw new BadRequestException({
      code: 'CSV_HEADER_NOT_FOUND',
      message: 'No usable CSV header row was found.',
    });
  const preambleTitle = lines
    .slice(0, headerIndex)
    .map((line) => line.trim().replace(/^"|"$/g, ''))
    .reverse()
    .find(
      (line) =>
        line &&
        !line.includes(':') &&
        !/^sep\s*=\s*/i.test(line) &&
        !/^(report generated|account)$/i.test(line),
    );
  const records = parseCsv(lines.slice(headerIndex).join('\n'), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as Record<string, unknown>[];
  const sourceColumns = Object.keys(records[0] ?? {}).map((column) =>
    column.trim(),
  );
  const columns = sourceColumns.map((column) =>
    column.toLowerCase() === 'primary' && preambleTitle
      ? preambleTitle
      : column,
  );
  const rows: ParsedImportRow[] = records.map((record, index) => ({
    sourceRowNumber: headerIndex + index + 2,
    data: Object.fromEntries(
      sourceColumns.map((sourceColumn, columnIndex) => [
        columns[columnIndex],
        normaliseCell(record[sourceColumn]),
      ]),
    ),
  }));
  return { format: 'CSV', sheets: ['CSV'], rows, columns };
}

function normaliseCell(value: unknown): ImportCell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return String(value);
}

async function parseWorkbook(buffer: Uint8Array): Promise<ParsedImportFile> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheets = workbook.worksheets.map((sheet) => sheet.name);
  const rows: ParsedImportRow[] = [];
  let columns: string[] = [];
  for (const sheet of workbook.worksheets) {
    const values = sheet.getSheetValues().slice(1) as unknown[][];
    const headerIndex = values.findIndex(
      (row) => row?.filter(Boolean).length >= 2,
    );
    if (headerIndex < 0) continue;
    const headerValues = Array.from(values[headerIndex] ?? []).slice(1);
    const headers = Array.from(headerValues, (value, index) =>
      String(value ?? `Column ${index + 1}`).trim(),
    );
    if (!columns.length) columns = headers;
    for (let index = headerIndex + 1; index < values.length; index += 1) {
      const source = Array.from(values[index] ?? []).slice(1);
      if (
        !source.some(
          (value) => value !== null && value !== undefined && value !== '',
        )
      )
        continue;
      rows.push({
        sourceRowNumber: index + 1,
        sheetName: sheet.name,
        data: Object.fromEntries(
          headers.flatMap((header, column) =>
            header ? [[header, normaliseCell(source[column])] as const] : [],
          ),
        ),
      });
    }
  }
  if (!rows.length || !columns.length)
    throw new BadRequestException({
      code: 'WORKBOOK_EMPTY',
      message: 'No tabular rows were found in the workbook.',
    });
  return { format: 'XLSX', sheets, rows, columns };
}

@Injectable()
export class FileParserService {
  async parse(file: {
    originalname: string;
    mimetype?: string;
    size: number;
    buffer: Buffer;
  }) {
    if (file.size > MAX_FILE_BYTES)
      throw new BadRequestException({
        code: 'IMPORT_FILE_TOO_LARGE',
        message: 'Import files must be 10 MB or smaller.',
      });
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (extension === 'csv') return parseCsvRows(file.buffer);
    if (extension === 'json') {
      let parsed: unknown;
      try {
        parsed = JSON.parse(file.buffer.toString('utf8'));
      } catch {
        throw new BadRequestException({
          code: 'JSON_INVALID',
          message: 'The JSON file is not valid.',
        });
      }
      const records = Array.isArray(parsed)
        ? parsed
        : parsed &&
            typeof parsed === 'object' &&
            Array.isArray((parsed as { data?: unknown }).data)
          ? (parsed as { data: unknown[] }).data
          : null;
      if (
        !records ||
        !records.every(
          (row) => row && typeof row === 'object' && !Array.isArray(row),
        )
      )
        throw new BadRequestException({
          code: 'JSON_NOT_TABULAR',
          message: 'JSON must be an array of objects or contain a data array.',
        });
      const rows: ParsedImportRow[] = records.map((record, index) => ({
        sourceRowNumber: index + 1,
        data: Object.fromEntries(
          Object.entries(record as Record<string, unknown>).map(
            ([key, value]) => [key, normaliseCell(value)],
          ),
        ),
      }));
      return {
        format: 'JSON' as const,
        sheets: ['JSON'],
        rows,
        columns: Object.keys(rows[0]?.data ?? {}),
      };
    }
    if (extension === 'xlsx') return parseWorkbook(file.buffer);
    throw new BadRequestException({
      code: 'IMPORT_FILE_TYPE_UNSUPPORTED',
      message: 'Only .csv, .json, and .xlsx files are supported.',
    });
  }
}
