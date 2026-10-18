import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { DatasetFileParser } from './dataset-file-parser.js';

describe('DatasetFileParser', () => {
  const parser = new DatasetFileParser();

  it('preserves duplicate and blank CSV headers, zero, negative values, and leading-zero identifiers', async () => {
    const buffer = Buffer.from(
      'Report generated\nDate,Metric,ID,,Metric\n2026-01-01,-1.25,0012,,0\n2026-01-02,2.75,0013,false,1\n',
    );
    const result = await parser.parse({
      originalname: 'export.csv',
      size: buffer.length,
      buffer,
    });
    const sheet = result.sheets[0]!;
    expect(sheet.columns.map((column) => column.originalName)).toEqual([
      'Date',
      'Metric',
      'ID',
      '',
      'Metric',
    ]);
    expect(sheet.columns.map((column) => column.id)).toEqual([
      'c1',
      'c2',
      'c3',
      'c4',
      'c5',
    ]);
    expect(sheet.columns.map((column) => column.type)).toEqual([
      'date',
      'number',
      'text',
      'text',
      'number',
    ]);
    expect(sheet.rows[0]?.cells).toEqual([
      '2026-01-01',
      '-1.25',
      '0012',
      '',
      '0',
    ]);
    expect(sheet.rows[0]?.typedCells[1]).toEqual({
      kind: 'number',
      value: '-1.25',
    });
    expect(sheet.rows[0]?.typedCells[4]).toEqual({
      kind: 'number',
      value: '0',
    });
  });

  it('keeps ambiguous dates as text and understands UTF-16 CSV exports', async () => {
    const buffer = Buffer.from(
      '\ufeffDate,Name\r\n02/03/2026,Spring\r\n',
      'utf16le',
    );
    const result = await parser.parse({
      originalname: 'dates.csv',
      size: buffer.length,
      buffer,
    });
    expect(result.sheets[0]?.columns[0]?.type).toBe('text');
    expect(result.sheets[0]?.rows[0]?.cells[0]).toBe('02/03/2026');
  });

  it('unions JSON object keys and keeps null, false, zero, and nested source values', async () => {
    const buffer = Buffer.from(
      '[{"day":"2026-03-01","clicks":0,"enabled":false,"extra":{"code":"A"},"precise":123456789012345678901234567890.12300},{"day":"2026-03-02","clicks":null,"other":"kept"}]',
    );
    const result = await parser.parse({
      originalname: 'table.json',
      size: buffer.length,
      buffer,
    });
    const sheet = result.sheets[0]!;
    expect(sheet.columns.map((column) => column.originalName)).toEqual([
      'day',
      'clicks',
      'enabled',
      'extra',
      'precise',
      'other',
    ]);
    expect(sheet.rows[0]?.cells).toEqual([
      '2026-03-01',
      { $cell: 'number', raw: '0' },
      false,
      { code: 'A' },
      {
        $cell: 'number',
        raw: '123456789012345678901234567890.12300',
      },
      null,
    ]);
    expect(sheet.rows[1]?.cells).toEqual([
      '2026-03-02',
      null,
      null,
      null,
      null,
      'kept',
    ]);
    expect(sheet.rows[0]?.typedCells[1]).toEqual({
      kind: 'number',
      value: '0',
    });
    expect(sheet.rows[0]?.typedCells[2]).toEqual({
      kind: 'boolean',
      value: false,
    });
    expect(sheet.rows[0]?.typedCells[4]).toEqual({
      kind: 'number',
      value: '123456789012345678901234567890.12300',
    });
  });

  it('keeps worksheet rows independent and stores formula source without evaluating it', async () => {
    const workbook = new ExcelJS.Workbook();
    const first = workbook.addWorksheet('Organic');
    first.addRow(['Date', 'Value']);
    first.addRow(['2026-04-01', { formula: '1+1', result: 2 }]);
    const second = workbook.addWorksheet('Paid');
    second.addRows([
      ['Date', 'Value'],
      ['2026-04-01', 3],
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parser.parse({
      originalname: 'channels.xlsx',
      size: buffer.length,
      buffer,
    });
    expect(
      result.sheets.map((sheet) => [sheet.name, sheet.rows.length]),
    ).toEqual([
      ['Organic', 1],
      ['Paid', 1],
    ]);
    expect(result.sheets[0]?.rows[0]?.cells[1]).toMatchObject({
      $cell: 'formula',
      formula: '1+1',
      cachedValue: { $cell: 'number', raw: '2', displayText: '2' },
    });
    expect(result.sheets[1]?.rows[0]?.cells[1]).toMatchObject({
      $cell: 'number',
      raw: '3',
    });
  });
});
