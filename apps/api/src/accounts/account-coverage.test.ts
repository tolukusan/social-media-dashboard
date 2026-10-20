import { describe, expect, it } from 'vitest';
import { accountMetricCoverage } from './account-coverage.js';

describe('accountMetricCoverage', () => {
  it('counts an actual zero as an observed day and reports gaps', () => {
    const coverage = accountMetricCoverage(
      [
        { date: '2026-01-01', value: 0 },
        { date: '2026-01-03', value: 4 },
      ],
      '2026-01-01',
      '2026-01-03',
    );

    expect(coverage).toEqual({
      status: 'PARTIAL',
      requestedDays: 3,
      observedDays: 2,
      firstObservedDate: '2026-01-01',
      lastObservedDate: '2026-01-03',
    });
  });

  it('returns NONE instead of treating missing days as zero', () => {
    expect(accountMetricCoverage([], '2026-01-01', '2026-01-01')).toEqual({
      status: 'NONE',
      requestedDays: 1,
      observedDays: 0,
      firstObservedDate: null,
      lastObservedDate: null,
    });
  });

  it('marks exact daily coverage complete', () => {
    expect(
      accountMetricCoverage(
        [
          { date: '2026-01-01', value: 0 },
          { date: '2026-01-02', value: 2 },
        ],
        '2026-01-01',
        '2026-01-02',
      ).status,
    ).toBe('COMPLETE');
  });
});
