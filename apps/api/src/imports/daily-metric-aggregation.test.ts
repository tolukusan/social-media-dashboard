import assert from 'node:assert/strict';
import { it } from 'vitest';
import {
  mergeRepeatedDailyMetrics,
  type ImportMetricRule,
} from './daily-metric-aggregation.js';

it('merges SUM, FIRST, and LAST values using their declared strategy', () => {
  const merged = mergeRepeatedDailyMetrics(
    { SUM_VALUE: 5, FIRST_VALUE: 1, LAST_VALUE: 2 },
    { SUM_VALUE: 7, FIRST_VALUE: 3, LAST_VALUE: 4 },
    new Map([
      ['SUM_VALUE', { kind: 'RAW', aggregationStrategy: 'SUM' }],
      ['FIRST_VALUE', { kind: 'RAW', aggregationStrategy: 'FIRST' }],
      ['LAST_VALUE', { kind: 'RAW', aggregationStrategy: 'LAST' }],
    ]),
    {},
  );
  assert.deepEqual(merged.values, {
    SUM_VALUE: 12,
    FIRST_VALUE: 1,
    LAST_VALUE: 4,
  });
  assert.deepEqual(merged.errors, []);
});

it('weights search position only by impressions from rows with both values', () => {
  const state = {};
  const definitions = new Map<string, ImportMetricRule>([
    [
      'SEO_AVG_POSITION',
      { kind: 'RAW', aggregationStrategy: 'WEIGHTED_AVERAGE' },
    ],
    ['SEO_SEARCH_IMPRESSIONS', { kind: 'RAW', aggregationStrategy: 'SUM' }],
  ]);
  const first = mergeRepeatedDailyMetrics(
    { SEO_AVG_POSITION: 2, SEO_SEARCH_IMPRESSIONS: 100 },
    { SEO_AVG_POSITION: 8, SEO_SEARCH_IMPRESSIONS: 300 },
    definitions,
    state,
  );
  assert.equal(first.values.SEO_AVG_POSITION, 6.5);
  const second = mergeRepeatedDailyMetrics(
    first.values,
    { SEO_SEARCH_IMPRESSIONS: 500 },
    definitions,
    state,
  );
  assert.equal(second.values.SEO_AVG_POSITION, 6.5);
  assert.equal(second.values.SEO_SEARCH_IMPRESSIONS, 900);
});

it('rejects repeated metrics whose aggregation is undefined', () => {
  const result = mergeRepeatedDailyMetrics(
    { POSITION_SNAPSHOT: 4 },
    { POSITION_SNAPSHOT: 8 },
    new Map<string, ImportMetricRule>([
      [
        'POSITION_SNAPSHOT',
        { kind: 'RAW', aggregationStrategy: 'WEIGHTED_AVERAGE' },
      ],
    ]),
    {},
  );
  assert.deepEqual(result.errors, ['POSITION_SNAPSHOT']);
  assert.equal(result.values.POSITION_SNAPSHOT, 4);
});
