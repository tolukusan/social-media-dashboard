import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  calculateKpis,
  comparisonPeriods,
  percentageChange,
  resolveTarget,
  targetStatus,
  trendGrain,
} from './calculations.js';

const rawCodes = [
  'SM_REACH',
  'SM_IMPRESSIONS',
  'SM_ENGAGEMENTS',
  'SM_LINK_CLICKS',
  'WEB_SESSIONS',
  'WEB_CONVERSIONS',
  'EMAIL_SENT',
  'EMAIL_DELIVERED',
  'EMAIL_OPENS',
  'EMAIL_CLICKS',
  'EMAIL_CONVERSIONS',
  'ADS_IMPRESSIONS',
  'ADS_REACH',
  'ADS_CLICKS',
  'ADS_SPEND',
  'ADS_CONVERSIONS',
  'SEO_ORGANIC_TRAFFIC',
  'SEO_SEARCH_IMPRESSIONS',
  'SEO_SEARCH_CLICKS',
  'SEO_AVG_POSITION',
];
const derivedCodes = [
  'SM_ENGAGEMENT_RATE',
  'SM_CTR',
  'WEB_CONVERSION_RATE',
  'EMAIL_OPEN_RATE',
  'EMAIL_CTR',
  'EMAIL_CONVERSION_RATE',
  'ADS_CTR',
  'ADS_CPC',
  'ADS_CONVERSION_RATE',
  'SEO_CTR',
];
const definitions = [
  ...rawCodes.map((code) => ({
    code,
    name: code,
    kind: 'RAW' as const,
    unit:
      code === 'SEO_AVG_POSITION' ? ('POSITION' as const) : ('COUNT' as const),
    aggregationStrategy:
      code === 'SEO_AVG_POSITION'
        ? ('WEIGHTED_AVERAGE' as const)
        : ('SUM' as const),
  })),
  ...derivedCodes.map((code) => ({
    code,
    name: code,
    kind: 'DERIVED' as const,
    unit: 'PERCENT' as const,
    aggregationStrategy: 'DERIVED' as const,
  })),
];

describe('calculateKpis', () => {
  it('aggregates numerator and denominator before calculating a rate', () => {
    const result = calculateKpis(
      [
        { SM_IMPRESSIONS: 10, SM_LINK_CLICKS: 1 },
        { SM_IMPRESSIONS: 1000, SM_LINK_CLICKS: 90 },
      ],
      definitions,
    );
    assert.ok(Math.abs(result.derived.SM_CTR! - 9.00990099009901) < 1e-12);
  });
  it('returns null for a zero denominator', () => {
    assert.equal(
      calculateKpis([{ SM_REACH: 0, SM_ENGAGEMENTS: 10 }], definitions).derived
        .SM_ENGAGEMENT_RATE,
      null,
    );
  });
  it('keeps missing input distinct from zero', () => {
    assert.equal(
      calculateKpis([{ SM_IMPRESSIONS: 100 }], definitions).derived.SM_CTR,
      null,
    );
    assert.equal(
      calculateKpis([{ SM_IMPRESSIONS: 100, SM_LINK_CLICKS: 0 }], definitions)
        .derived.SM_CTR,
      0,
    );
    assert.equal(
      calculateKpis([{ WEB_CONVERSIONS: 7 }], definitions).rawTotals
        .WEB_CONVERSIONS,
      7,
    );
    assert.equal(
      calculateKpis([{ ADS_CONVERSIONS: 5 }], definitions).rawTotals
        .ADS_CONVERSIONS,
      5,
    );
  });
  it('calculates weighted SEO average position by paired impressions', () => {
    const result = calculateKpis(
      [
        { SEO_AVG_POSITION: 2, SEO_SEARCH_IMPRESSIONS: 100 },
        { SEO_AVG_POSITION: 8, SEO_SEARCH_IMPRESSIONS: 300 },
      ],
      definitions,
    );
    assert.equal(result.rawTotals.SEO_AVG_POSITION, 6.5);
    const missingPosition = calculateKpis(
      [
        { SEO_AVG_POSITION: 2, SEO_SEARCH_IMPRESSIONS: 100 },
        { SEO_SEARCH_IMPRESSIONS: 300 },
      ],
      definitions,
    );
    assert.equal(missingPosition.rawTotals.SEO_AVG_POSITION, 2);
    assert.equal(
      calculateKpis([{ SEO_SEARCH_IMPRESSIONS: 100 }], definitions).rawTotals
        .SEO_AVG_POSITION,
      null,
    );
  });
  it('applies FIRST and LAST aggregation metadata and leaves unknown weights unavailable', () => {
    const strategyDefinitions = [
      {
        code: 'A',
        name: 'A',
        kind: 'RAW' as const,
        unit: 'COUNT' as const,
        aggregationStrategy: 'FIRST' as const,
      },
      {
        code: 'B',
        name: 'B',
        kind: 'RAW' as const,
        unit: 'COUNT' as const,
        aggregationStrategy: 'LAST' as const,
      },
      {
        code: 'C',
        name: 'C',
        kind: 'RAW' as const,
        unit: 'DECIMAL' as const,
        aggregationStrategy: 'WEIGHTED_AVERAGE' as const,
      },
    ];
    const result = calculateKpis(
      [
        { A: 1, B: 2 },
        { A: 3, B: 4 },
      ],
      strategyDefinitions,
    );
    assert.equal(result.rawTotals.A, 1);
    assert.equal(result.rawTotals.B, 4);
    assert.equal(result.rawTotals.C, null);
  });
});

describe('target resolution', () => {
  it('chooses the highest-specificity applicable target', () => {
    const date = new Date('2026-01-15T00:00:00Z');
    const base = {
      periodType: 'MONTHLY',
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      targetValue: 3,
      comparisonRule: 'HIGHER_IS_BETTER' as const,
    };
    const target = resolveTarget(
      [
        { ...base, id: 'global', scopeType: 'GLOBAL' },
        { ...base, id: 'channel', scopeType: 'CHANNEL', channelId: 'ch' },
        { ...base, id: 'campaign', scopeType: 'CAMPAIGN', campaignId: 'camp' },
      ],
      { campaignId: 'camp', channelId: 'ch' },
      'MONTHLY',
      date,
    );
    assert.equal(target?.id, 'campaign');
  });

  it('returns neutral status values for missing data and targets', () => {
    assert.equal(targetStatus(4, null), 'NO_TARGET');
    assert.equal(
      targetStatus(8, {
        id: 'higher-target',
        scopeType: 'GLOBAL',
        periodType: 'MONTHLY',
        effectiveFrom: new Date('2026-01-01'),
        targetValue: 10,
        comparisonRule: 'HIGHER_IS_BETTER',
      }),
      'MISSES_TARGET',
    );
    assert.equal(
      targetStatus(8, {
        id: 'lower-target',
        scopeType: 'GLOBAL',
        periodType: 'MONTHLY',
        effectiveFrom: new Date('2026-01-01'),
        targetValue: 10,
        comparisonRule: 'LOWER_IS_BETTER',
      }),
      'MEETS_TARGET',
    );
    assert.equal(
      targetStatus(null, {
        id: 'target',
        scopeType: 'GLOBAL',
        periodType: 'MONTHLY',
        effectiveFrom: new Date('2026-01-01'),
        targetValue: 10,
        comparisonRule: 'HIGHER_IS_BETTER',
      }),
      'NO_DATA',
    );
  });

  it('requires an effective target to cover the whole evaluation period', () => {
    const target = {
      id: 'monthly',
      scopeType: 'GLOBAL' as const,
      periodType: 'MONTHLY',
      effectiveFrom: new Date('2026-01-15T00:00:00Z'),
      effectiveTo: new Date('2026-01-31T00:00:00Z'),
      targetValue: 10,
      comparisonRule: 'HIGHER_IS_BETTER' as const,
    };
    assert.equal(
      resolveTarget([target], {}, 'MONTHLY', new Date('2026-01-20T00:00:00Z'), {
        from: new Date('2026-01-01T00:00:00Z'),
        to: new Date('2026-01-31T00:00:00Z'),
      }),
      null,
    );
  });
});

describe('period helpers', () => {
  it('selects approved automatic trend grains', () => {
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-01-31')),
      'DAILY',
    );
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-03-01')),
      'WEEKLY',
    );
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-06-01')),
      'MONTHLY',
    );
  });

  it('compares elapsed current period with the matching previous period', () => {
    const result = comparisonPeriods(
      new Date('2026-09-01'),
      new Date('2026-09-23'),
    );
    assert.equal(
      result.previous.from.toISOString(),
      '2026-08-09T00:00:00.000Z',
    );
    assert.equal(result.previous.to.toISOString(), '2026-08-31T23:59:59.999Z');
  });

  it('aligns calendar comparisons across unequal month lengths and leap years', () => {
    const month = comparisonPeriods(
      new Date('2026-09-01T00:00:00Z'),
      new Date('2026-09-23T23:59:59.999Z'),
      'MONTH',
    );
    assert.equal(month.current.from.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(month.previous.from.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(month.previous.to.toISOString(), '2026-08-23T23:59:59.999Z');
    assert.equal(month.isPartial, true);

    const leap = comparisonPeriods(
      new Date('2024-01-01T00:00:00Z'),
      new Date('2024-12-31T23:59:59.999Z'),
      'YEAR',
    );
    assert.equal(leap.previous.from.toISOString(), '2023-01-01T00:00:00.000Z');
    assert.equal(leap.previous.to.toISOString(), '2023-12-31T23:59:59.999Z');
    assert.equal(leap.isPartial, false);
  });

  it('returns finite percentage changes for zero and unavailable baselines', () => {
    assert.equal(percentageChange(0, 0), 0);
    assert.equal(percentageChange(1, 0), null);
    assert.equal(percentageChange(2, null), null);
    assert.equal(percentageChange(15, 10), 50);
  });

  it('uses exact daily and weekly grain thresholds', () => {
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-01-31')),
      'DAILY',
    );
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-02-01')),
      'WEEKLY',
    );
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-04-30')),
      'WEEKLY',
    );
    assert.equal(
      trendGrain(new Date('2026-01-01'), new Date('2026-05-01')),
      'MONTHLY',
    );
  });
});
