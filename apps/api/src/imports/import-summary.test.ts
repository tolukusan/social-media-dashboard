import { describe, it, expect } from 'vitest';
import { summarizeImport } from './import-summary.js';
import type { NormalizedImportRow } from './import.types.js';

describe('guided import summaries', () => {
  const row = (changes: Partial<NormalizedImportRow>): NormalizedImportRow => ({
    campaignId: 'campaign-a',
    platformId: 'platform-a',
    recordDate: '2024-07-01',
    sourceRowNumber: 1,
    metrics: { SM_VIEWS: 0 },
    ...changes,
  });
  it('counts canonical daily records, preserves zero, and excludes aggregated source rows', () => {
    const summary = summarizeImport([
      row({ recordDate: '2024-07-03' }),
      row({ mergedIntoSourceRowNumber: 1 }),
      row({ recordDate: '2024-07-01', metrics: { SM_FOLLOWERS_GAINED: 2 } }),
      row({ recordDate: '2024-07-02', metrics: {} }),
    ]);
    expect(summary.dailyRecords).toBe(3);
    expect(summary.unchangedRecords).toBe(1);
    expect(summary.scopes[0]).toEqual({
      campaignId: 'campaign-a',
      platformId: 'platform-a',
      from: '2024-07-01',
      to: '2024-07-03',
      metricCodes: ['SM_VIEWS', 'SM_FOLLOWERS_GAINED'],
      dailyRecords: 3,
      unchangedRecords: 1,
    });
  });
  it('keeps campaign/platform result scopes separate and supports no accepted records', () => {
    expect(summarizeImport([]).scopes).toEqual([]);
    expect(
      summarizeImport([
        row({}),
        row({ campaignId: 'campaign-b' }),
        row({ platformId: 'platform-b' }),
      ]).scopes,
    ).toHaveLength(3);
  });
});
