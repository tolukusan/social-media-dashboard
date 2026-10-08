import { describe, expect, it } from 'vitest';
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderReportPdf, type PdfReportData } from './pdf-renderer.js';

function fixture(): PdfReportData {
  return {
    title: 'Digital Marketing Performance Report',
    generatedAt: '7 October 2026, 12:00:00 UTC',
    timeZone: 'UTC',
    reportingCurrency: 'GBP',
    period: { from: '2026-09-01', to: '2026-09-03' },
    filters: {
      campaign: 'Café Autumn Δ',
      channel: 'Social Media',
      platform: 'Example platform',
      metric: 'Click-through rate',
      targetPeriod: 'MONTHLY',
    },
    summary: {
      recordCount: 3,
      campaignCount: 1,
      channelCount: 1,
      kpis: [
        {
          label: 'Click-through rate',
          unit: 'PERCENT',
          value: 5,
          aggregationNote: null,
          target: {
            status: 'MEETS_TARGET',
            target: { value: 4, comparisonRule: 'HIGHER_IS_BETTER' },
          },
        },
        {
          label: 'Spend £',
          unit: 'CURRENCY',
          value: 123.45,
          aggregationNote: null,
          target: null,
        },
        {
          label: 'Cost per click',
          unit: 'CURRENCY',
          value: null,
          aggregationNote: null,
          target: null,
        },
      ],
    },
    comparison: null,
    trend: {
      grain: 'DAILY',
      metric: 'Click-through rate',
      unit: 'PERCENT',
      points: [
        { bucket: '2026-09-01', value: 4 },
        { bucket: '2026-09-02', value: null },
        { bucket: '2026-09-03', value: 6 },
      ],
    },
    caveats: [],
  };
}

async function inspect(report: PdfReportData) {
  const pdf = await renderReportPdf(report);
  const task = getDocument({ data: new Uint8Array(pdf) });
  const document = await task.promise;
  try {
    const pages = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const { items } = await page.getTextContent();
      const text = items.filter((item) => 'str' in item);
      const operators = await page.getOperatorList();
      pages.push({
        text,
        width: page.getViewport({ scale: 1 }).width,
        vectorPathCount: operators.fnArray.filter(
          (operator) => operator === OPS.constructPath,
        ).length,
      });
      page.cleanup();
    }
    return {
      pages,
      text: pages
        .flatMap((page) => page.text.map((item) => item.str))
        .join(' '),
    };
  } finally {
    await task.destroy();
  }
}

describe('rendered PDF acceptance', () => {
  it('retains Unicode, filtered values and target status within page bounds after a chart', async () => {
    const report = fixture();
    const result = await inspect(report);
    for (const text of [
      report.generatedAt,
      '2026-09-01',
      '2026-09-03',
      'Café Autumn Δ',
      'Spend £',
      'GBP 123.45',
      '5.00%',
      '6.00%',
      'MEETS_TARGET',
      'Unavailable',
    ])
      expect(result.text).toContain(text);
    const heading = result.pages
      .flatMap((page) => page.text)
      .find((item) => item.str === 'KPI values');
    expect(heading).toBeDefined();
    expect(heading!.transform[4]).toBeCloseTo(48);
    for (const page of result.pages)
      for (const item of page.text) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(47);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(
          page.width - 47,
        );
      }
    // Inspect vector paths so extra chart text cannot satisfy the assertion.
    const withoutChart = await inspect({ ...report, trend: null });
    expect(
      result.pages.reduce((sum, page) => sum + page.vectorPathCount, 0),
    ).toBeGreaterThan(
      withoutChart.pages.reduce((sum, page) => sum + page.vectorPathCount, 0),
    );
  });

  it('wraps and paginates long content without dropping its final values', async () => {
    const report = fixture();
    report.filters.campaign = 'Long campaign label '.repeat(30);
    report.caveats = Array.from(
      { length: 80 },
      (_, index) =>
        `Note ${index + 1}: ${'Historical attribution remains interpretable. '.repeat(8)}`,
    );
    report.caveats.push('FINAL CONTENT SENTINEL');
    const result = await inspect(report);
    expect(result.pages.length).toBeGreaterThan(2);
    expect(result.text).toContain('Note 1:');
    expect(result.text).toContain('Note 80:');
    expect(result.text).toContain('FINAL CONTENT SENTINEL');
    for (const page of result.pages)
      for (const item of page.text)
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(
          page.width - 47,
        );
  });

  it('explains a single trend value and distinguishes unavailable data from zero', async () => {
    const report = fixture();
    report.trend!.points = [{ bucket: '2026-09-01', value: 0 }];
    const single = await inspect(report);
    expect(single.text).toContain('0.00%');
    expect(single.text).toContain('only one trend value is available');
    report.trend!.points[0].value = null;
    const missing = await inspect(report);
    expect(missing.text).toContain(
      'No values available for the selected period',
    );
    expect(missing.text).not.toContain('only one trend value is available');
  });
});
