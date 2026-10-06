import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { FileParserService } from './file-parser.service.js';

describe('FileParserService', () => {
  const parser = new FileParserService();

  it('finds a table after Meta-style UTF-16 CSV preamble', async () => {
    const text =
      'Report generated\nAccount: demo\nDate,Primary\n2026-01-01,2170\n2026-01-02,1900\n';
    const encoded = Buffer.from(`\ufeff${text}`, 'utf16le');
    const result = await parser.parse({
      originalname: 'views.csv',
      mimetype: 'text/csv',
      size: encoded.length,
      buffer: encoded,
    });
    assert.equal(result.format, 'CSV');
    assert.deepEqual(result.columns, ['Date', 'Primary']);
    assert.equal(result.rows[0]?.data.Primary, '2170');
  });

  it('promotes a Meta metric title from the CSV preamble', async () => {
    const buffer = Buffer.from(
      'sep=,\n"Facebook follows"\n"Date","Primary"\n"2026-01-01","2"\n',
    );
    const result = await parser.parse({
      originalname: 'follows.csv',
      mimetype: 'text/csv',
      size: buffer.length,
      buffer,
    });
    assert.deepEqual(result.columns, ['Date', 'Facebook follows']);
    assert.equal(result.rows[0]?.data['Facebook follows'], '2');
  });

  it('parses JSON arrays without converting missing values to zero', async () => {
    const buffer = Buffer.from(
      JSON.stringify([
        { date: '2026-01-01', clicks: 0 },
        { date: '2026-01-02' },
      ]),
    );
    const result = await parser.parse({
      originalname: 'data.json',
      mimetype: 'application/json',
      size: buffer.length,
      buffer,
    });
    assert.equal(result.rows[0]?.data.clicks, 0);
    assert.equal(result.rows[1]?.data.clicks, undefined);
  });

  it('reads every worksheet in an XLSX workbook without merging sheet rows', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('January').addRows([
      ['Date', 'Reach'],
      ['2026-01-01', 10],
    ]);
    workbook.addWorksheet('February').addRows([
      ['Date', 'Reach'],
      ['2026-02-01', 20],
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const result = await parser.parse({
      originalname: 'data.xlsx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: buffer.length,
      buffer,
    });
    assert.deepEqual(result.sheets, ['January', 'February']);
    assert.equal(result.rows.length, 2);
    assert.deepEqual(result.columns, ['Date', 'Reach']);
    assert.equal(result.rows[0]?.data.Date, '2026-01-01');
    assert.equal(result.rows[0]?.data.Reach, 10);
    assert.equal(result.rows[1]?.sheetName, 'February');
  });
});
