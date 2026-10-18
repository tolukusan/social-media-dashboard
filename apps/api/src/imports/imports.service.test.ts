import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseDate } from './imports.service.js';

describe('import date normalization', () => {
  it('preserves an ISO calendar date when a timestamp is present', () => {
    assert.equal(
      parseDate('2026-01-01 1:00:00')?.toISOString(),
      '2026-01-01T00:00:00.000Z',
    );
  });

  it('normalizes named Excel export timestamps without a timezone shift', () => {
    assert.equal(
      parseDate('Nov 25, 2024 12:30 PM')?.toISOString(),
      '2024-11-25T00:00:00.000Z',
    );
  });

  it('normalizes US slash dates used by LinkedIn analytics exports', () => {
    assert.equal(
      parseDate('09/24/2025')?.toISOString(),
      '2025-09-24T00:00:00.000Z',
    );
  });

  it('rejects impossible US slash dates', () => {
    assert.equal(parseDate('02/30/2025'), null);
  });
});
