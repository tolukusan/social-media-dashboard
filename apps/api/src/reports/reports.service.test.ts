import { test, expect } from 'vitest';
import { ReportsService } from './reports.service.js';
const result = {
  recordCount: 1,
  campaignCount: 1,
  channelCount: 1,
  kpis: { ZERO: 0, MISSING: null },
  metricMetadata: [
    { code: 'ZERO', label: 'Zero count', unit: 'COUNT' },
    { code: 'MISSING', label: 'Missing count', unit: 'COUNT' },
  ],
  reportingContext: { currencyCode: null, timeZone: 'UTC' },
  targetEvaluations: {},
};
const service = new ReportsService(
  { dashboard: async () => result } as never,
  {} as never,
);
test('report assembly filters unavailable values on the backend, retains zero and applies the same summary to preview/PDF', async () => {
  const report = await service.assemble({});
  expect(report.summary.kpis.map((k) => k.code)).toEqual(['ZERO']);
  expect(report.summary.kpis[0].value).toBe(0);
  expect(report.pdf.subarray(0, 4).toString()).toBe('%PDF');
  const included = await service.assemble({
    includeUnavailableMetrics: 'true',
  });
  expect(included.summary.kpis.map((k) => k.value)).toEqual([0, null]);
  expect(
    (await service.preview({ includeUnavailableMetrics: 'true' })).summary,
  ).toEqual(included.summary);
  expect(
    (await service.preview({ includeUnavailableMetrics: 'false' })).summary,
  ).toEqual(report.summary);
});
