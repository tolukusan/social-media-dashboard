import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { parse as parseCsvRecords } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

export type DatasetColumnType =
  'text' | 'number' | 'boolean' | 'date' | 'mixed';

export type DatasetColumn = {
  id: string;
  ordinal: number;
  originalName: string;
  label: string;
  type: DatasetColumnType;
  dateLike: boolean;
  meaning?: string | null;
  unit?: string | null;
};

export type DatasetRowInput = {
  sourceRowNumber: number;
  cells: unknown[];
  typedCells: Array<{ kind: DatasetColumnType | 'null'; value: unknown }>;
};

export type DatasetSheet = {
  key: string;
  name: string;
  columns: DatasetColumn[];
  rows: DatasetRowInput[];
  headerFingerprint: string;
};

export type ParsedDatasetFile = {
  format: 'CSV' | 'JSON' | 'XLSX';
  sheets: DatasetSheet[];
};

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_EXPANDED_WORKBOOK_BYTES = 50 * 1024 * 1024;
const MAX_ROWS = 100_000;
const MAX_COLUMNS = 500;
const MAX_CELLS = 1_000_000;
const SINGLE_SHEET_KEY = 'single';

function invalidFile(code: string, message: string): never {
  throw new BadRequestException({ code, message });
}

function decodeText(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe)
    return new TextDecoder('utf-16le').decode(buffer.subarray(2));
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff)
    return new TextDecoder('utf-16be').decode(buffer.subarray(2));
  return new TextDecoder('utf-8').decode(
    buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf
      ? buffer.subarray(3)
      : buffer,
  );
}

function ensureTableSize(rows: number, columns: number) {
  if (rows > MAX_ROWS || columns > MAX_COLUMNS || rows * columns > MAX_CELLS)
    invalidFile(
      'DATASET_TABLE_TOO_LARGE',
      'This file contains too many rows or columns to import safely.',
    );
}

function safeJsonValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value;
  if (typeof value === 'number')
    return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return { $cell: 'date', iso: value.toISOString() };
  if (Array.isArray(value)) return value.map(safeJsonValue);
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, safeJsonValue(child)] as const);
    return Object.fromEntries(entries);
  }
  return String(value);
}

function excelCellValue(value: unknown, displayText: string): unknown {
  if (value instanceof Date)
    return { $cell: 'date', iso: value.toISOString(), displayText };
  if (typeof value === 'number')
    return { $cell: 'number', raw: String(value), displayText };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const cell = value as Record<string, unknown>;
    if (
      typeof cell.formula === 'string' ||
      typeof cell.sharedFormula === 'string'
    )
      return {
        $cell: 'formula',
        formula: cell.formula ?? null,
        sharedFormula: cell.sharedFormula ?? null,
        cachedValue:
          typeof cell.result === 'number'
            ? { $cell: 'number', raw: String(cell.result), displayText }
            : safeJsonValue(cell.result ?? null),
        displayText,
      };
    if (Array.isArray(cell.richText))
      return {
        $cell: 'richText',
        text: cell.richText
          .map((part) =>
            part && typeof part === 'object' && 'text' in part
              ? String((part as { text: unknown }).text)
              : '',
          )
          .join(''),
      };
    if (typeof cell.text === 'string' && typeof cell.hyperlink === 'string')
      return { $cell: 'hyperlink', text: cell.text, target: cell.hyperlink };
    if (typeof cell.error === 'string')
      return { $cell: 'error', value: cell.error };
  }
  return safeJsonValue(value ?? null);
}

function inferredScalar(value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const cell = value as Record<string, unknown>;
    if (cell.$cell === 'date' && typeof cell.iso === 'string') return cell.iso;
    if (cell.$cell === 'number' && typeof cell.raw === 'string')
      return cell.raw;
    if (cell.$cell === 'formula') return inferredScalar(cell.cachedValue);
    if (cell.$cell === 'richText' || cell.$cell === 'hyperlink')
      return typeof cell.text === 'string' ? cell.text : null;
  }
  return value;
}

function strictDate(value: unknown): string | null {
  const scalar = inferredScalar(value);
  if (typeof scalar !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(scalar)) {
    const date = new Date(`${scalar}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== scalar
      ? null
      : scalar;
  }
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(
      scalar,
    )
  ) {
    const date = new Date(scalar);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(scalar);
  if (usDate) {
    const month = Number(usDate[1]);
    const day = Number(usDate[2]);
    const year = Number(usDate[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31 || day <= 12)
      return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
      ? date.toISOString().slice(0, 10)
      : null;
  }
  return null;
}

function numericString(value: unknown): string | null {
  const scalar = inferredScalar(value);
  if (typeof scalar === 'number')
    return Number.isFinite(scalar) ? String(scalar) : null;
  if (typeof scalar !== 'string' || !scalar.trim()) return null;
  const normalized = scalar.trim();
  if (/^0\d+$/.test(normalized)) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized))
    return null;
  return normalized;
}

function parseJsonLossless(text: string): unknown {
  let nonce = `__smd_number_${randomUUID()}__`;
  while (text.includes(nonce)) nonce = `__smd_number_${randomUUID()}__`;
  let transformed = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length;) {
    const character = text[index]!;
    if (inString) {
      transformed += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      index += 1;
      continue;
    }
    if (character === '"') {
      inString = true;
      transformed += character;
      index += 1;
      continue;
    }
    if (character === '-' || /\d/.test(character)) {
      const numericToken = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
        text.slice(index),
      )?.[0];
      if (numericToken) {
        const next = text[index + numericToken.length];
        if (next === undefined || /[\s,\]}]/.test(next)) {
          transformed += JSON.stringify(`${nonce}${numericToken}`);
          index += numericToken.length;
          continue;
        }
      }
    }
    transformed += character;
    index += 1;
  }
  const parsed: unknown = JSON.parse(transformed);
  const restoreNumbers = (value: unknown): unknown => {
    if (typeof value === 'string' && value.startsWith(nonce))
      return { $cell: 'number', raw: value.slice(nonce.length) };
    if (Array.isArray(value)) return value.map(restoreNumbers);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [
          key,
          restoreNumbers(item),
        ]),
      );
    return value;
  };
  return restoreNumbers(parsed);
}

function detectType(values: unknown[]): DatasetColumnType {
  const present = values.filter((value) => value !== null && value !== '');
  if (!present.length) return 'text';
  const scalars = present.map(inferredScalar);
  if (scalars.every((value) => typeof value === 'boolean')) return 'boolean';
  if (present.every((value) => numericString(value) !== null)) return 'number';
  if (present.every((value) => strictDate(value) !== null)) return 'date';
  if (scalars.every((value) => typeof value === 'string')) return 'text';
  return 'mixed';
}

function typedCell(value: unknown, type: DatasetColumnType) {
  if (value === null || value === undefined || value === '')
    return { kind: 'null' as const, value: null };
  if (type === 'number')
    return { kind: 'number' as const, value: numericString(value) };
  if (type === 'boolean') {
    const scalar = inferredScalar(value);
    return { kind: 'boolean' as const, value: scalar };
  }
  if (type === 'date')
    return { kind: 'date' as const, value: strictDate(value) };
  if (type === 'text' && typeof inferredScalar(value) === 'string')
    return { kind: 'text' as const, value: inferredScalar(value) };
  return { kind: 'mixed' as const, value: safeJsonValue(value) };
}

function tableSheet(
  key: string,
  name: string,
  headers: string[],
  sourceRows: Array<{ sourceRowNumber: number; cells: unknown[] }>,
): DatasetSheet {
  ensureTableSize(sourceRows.length, headers.length);
  const columns: DatasetColumn[] = headers.map((originalName, ordinal) => {
    const type = detectType(
      sourceRows.map((row) => row.cells[ordinal] ?? null),
    );
    return {
      id: `c${ordinal + 1}`,
      ordinal,
      originalName,
      label: originalName || `Column ${ordinal + 1}`,
      type,
      dateLike: type === 'date',
    };
  });
  const rows = sourceRows.map((row) => {
    const cells = Array.from({ length: headers.length }, (_, index) =>
      safeJsonValue(row.cells[index] ?? null),
    );
    return {
      sourceRowNumber: row.sourceRowNumber,
      cells,
      typedCells: cells.map((value, ordinal) =>
        typedCell(value, columns[ordinal]!.type),
      ),
    };
  });
  return {
    key,
    name,
    columns,
    rows,
    headerFingerprint: createHash('sha256')
      .update(JSON.stringify(headers))
      .digest('hex'),
  };
}

function parseCsv(buffer: Buffer): ParsedDatasetFile {
  let records: string[][];
  try {
    records = parseCsvRecords(decodeText(buffer), {
      bom: true,
      columns: false,
      skip_empty_lines: false,
      relax_column_count: true,
      relax_quotes: true,
      trim: false,
    }) as string[][];
  } catch {
    invalidFile('DATASET_CSV_INVALID', 'This CSV file could not be read.');
  }
  if (!records.length)
    invalidFile('DATASET_TABLE_EMPTY', 'This file does not contain a table.');
  const headerIndex = records.findIndex(
    (row) => row.filter((value) => value.trim() !== '').length >= 2,
  );
  const resolvedHeaderIndex =
    headerIndex >= 0
      ? headerIndex
      : records.findIndex((row) => row.some((value) => value !== ''));
  if (resolvedHeaderIndex < 0)
    invalidFile('DATASET_TABLE_EMPTY', 'This file does not contain a table.');
  const headerRow = records[resolvedHeaderIndex]!;
  const width = Math.max(
    headerRow.length,
    ...records.slice(resolvedHeaderIndex + 1).map((row) => row.length),
  );
  ensureTableSize(records.length - resolvedHeaderIndex - 1, width);
  const headers = Array.from(
    { length: width },
    (_, index) => headerRow[index] ?? '',
  );
  const rows = records.slice(resolvedHeaderIndex + 1).map((record, index) => ({
    sourceRowNumber: index + 1,
    cells: Array.from(
      { length: width },
      (_, ordinal) => record[ordinal] ?? null,
    ),
  }));
  return {
    format: 'CSV',
    sheets: [tableSheet(SINGLE_SHEET_KEY, 'CSV file', headers, rows)],
  };
}

function parseJson(buffer: Buffer): ParsedDatasetFile {
  let parsed: unknown;
  try {
    parsed = parseJsonLossless(decodeText(buffer));
  } catch {
    invalidFile('DATASET_JSON_INVALID', 'This JSON file is not valid.');
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
    invalidFile(
      'DATASET_JSON_NOT_TABULAR',
      'JSON must contain an array of objects.',
    );
  const headers: string[] = [];
  for (const row of records as Record<string, unknown>[]) {
    for (const key of Object.keys(row))
      if (!headers.includes(key)) headers.push(key);
  }
  if (!headers.length)
    invalidFile(
      'DATASET_TABLE_EMPTY',
      'This JSON file does not contain any columns.',
    );
  ensureTableSize(records.length, headers.length);
  const rows = (records as Record<string, unknown>[]).map((record, index) => ({
    sourceRowNumber: index + 1,
    cells: headers.map((header) =>
      Object.hasOwn(record, header) ? safeJsonValue(record[header]) : null,
    ),
  }));
  return {
    format: 'JSON',
    sheets: [tableSheet(SINGLE_SHEET_KEY, 'JSON file', headers, rows)],
  };
}

function assertWorkbookSize(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0)
    invalidFile('DATASET_XLSX_INVALID', 'This workbook could not be read.');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    offset === 0xffffffff
  )
    invalidFile(
      'DATASET_XLSX_TOO_LARGE',
      'This workbook uses an unsupported expanded format.',
    );
  if (offset + directorySize > eocd)
    invalidFile('DATASET_XLSX_INVALID', 'This workbook could not be read.');
  let expandedSize = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50)
      invalidFile('DATASET_XLSX_INVALID', 'This workbook could not be read.');
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    if (uncompressedSize === 0xffffffff)
      invalidFile(
        'DATASET_XLSX_TOO_LARGE',
        'This workbook uses an unsupported expanded format.',
      );
    expandedSize += uncompressedSize;
    if (expandedSize > MAX_EXPANDED_WORKBOOK_BYTES)
      invalidFile(
        'DATASET_XLSX_TOO_LARGE',
        'This workbook expands beyond the safe import limit.',
      );
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    offset += 46 + nameLength + extraLength + commentLength;
  }
}

async function parseWorkbook(buffer: Buffer): Promise<ParsedDatasetFile> {
  assertWorkbookSize(buffer);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    invalidFile('DATASET_XLSX_INVALID', 'This workbook could not be read.');
  }
  const sheets: DatasetSheet[] = [];
  let cellCount = 0;
  for (const worksheet of workbook.worksheets) {
    if (
      worksheet.rowCount > MAX_ROWS + 1 ||
      worksheet.columnCount > MAX_COLUMNS
    )
      invalidFile(
        'DATASET_TABLE_TOO_LARGE',
        'This workbook contains too many rows or columns to import safely.',
      );
    const rows = Array.from({ length: worksheet.rowCount }, (_, index) =>
      worksheet.getRow(index + 1),
    );
    const values = (rowNumber: number) =>
      Array.from(
        { length: worksheet.columnCount },
        (_, index) => worksheet.getRow(rowNumber).getCell(index + 1).value,
      );
    let headerRowIndex = rows.findIndex(
      (row) =>
        values(row.number).filter(
          (value) => value !== null && value !== undefined && value !== '',
        ).length >= 2,
    );
    if (headerRowIndex < 0)
      headerRowIndex = rows.findIndex((row) =>
        values(row.number).some(
          (value) => value !== null && value !== undefined && value !== '',
        ),
      );
    if (headerRowIndex < 0) continue;
    const headerRow = rows[headerRowIndex]!;
    const headers = Array.from(
      { length: worksheet.columnCount },
      (_, ordinal) => headerRow.getCell(ordinal + 1).text,
    );
    const sourceRows: Array<{ sourceRowNumber: number; cells: unknown[] }> = [];
    for (
      let rowIndex = headerRowIndex + 1;
      rowIndex < rows.length;
      rowIndex += 1
    ) {
      const row = rows[rowIndex]!;
      const cells = headers.map((_, ordinal) => {
        const cell = row.getCell(ordinal + 1);
        return excelCellValue(cell.value, cell.text);
      });
      if (cells.every((value) => value === null || value === '')) continue;
      sourceRows.push({ sourceRowNumber: row.number, cells });
      cellCount += cells.length;
      if (sourceRows.length > MAX_ROWS || cellCount > MAX_CELLS)
        invalidFile(
          'DATASET_TABLE_TOO_LARGE',
          'This workbook contains too much tabular data.',
        );
    }
    if (!headers.length) continue;
    ensureTableSize(sourceRows.length, headers.length);
    sheets.push(
      tableSheet(worksheet.name, worksheet.name, headers, sourceRows),
    );
  }
  if (!sheets.length)
    invalidFile(
      'DATASET_TABLE_EMPTY',
      'No tabular worksheets were found in this workbook.',
    );
  const populated = sheets.filter((sheet) => sheet.rows.length > 0);
  return {
    format: 'XLSX',
    sheets: populated.length ? populated : [sheets[0]!],
  };
}

@Injectable()
export class DatasetFileParser {
  async parse(file: { originalname: string; size: number; buffer: Buffer }) {
    if (file.size > MAX_FILE_BYTES)
      invalidFile(
        'IMPORT_FILE_TOO_LARGE',
        'Import files must be 10 MB or smaller.',
      );
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (extension === 'csv') return parseCsv(file.buffer);
    if (extension === 'json') return parseJson(file.buffer);
    if (extension === 'xlsx') return parseWorkbook(file.buffer);
    return invalidFile(
      'IMPORT_FILE_TYPE_UNSUPPORTED',
      'Only CSV, JSON, and XLSX files are supported.',
    );
  }
}
