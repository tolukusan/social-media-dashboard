import { describe, expect, it } from 'vitest';
import { planMetaHistory } from './account-history-plan.js';

describe('planMetaHistory', () => {
  it('clips Instagram to its latest 90 days and chunks by calendar day', () => {
    const plan = planMetaHistory(
      'INSTAGRAM',
      '2025-10-20',
      '2026-10-19',
      '2026-10-19',
    );
    expect(plan.fetchFrom).toBe('2026-07-22');
    expect(plan.fetchTo).toBe('2026-10-19');
    expect(plan.chunks).toHaveLength(90);
    expect(plan.chunks[0]).toEqual({
      sequence: 0,
      from: '2026-10-19',
      to: '2026-10-19',
    });
    expect(plan.chunks.at(-1)).toEqual({
      sequence: 89,
      from: '2026-07-22',
      to: '2026-07-22',
    });
  });

  it('splits Facebook history into newest-first inclusive 30-day chunks', () => {
    const plan = planMetaHistory(
      'FACEBOOK',
      '2025-10-20',
      '2026-10-19',
      '2026-10-19',
    );
    expect(plan.chunks).toHaveLength(13);
    expect(plan.chunks[0]).toEqual({
      sequence: 0,
      from: '2026-09-20',
      to: '2026-10-19',
    });
    expect(plan.chunks[12]).toEqual({
      sequence: 12,
      from: '2025-10-20',
      to: '2025-10-24',
    });
  });

  it('returns no chunks when Instagram has no overlap with its available history', () => {
    const plan = planMetaHistory(
      'INSTAGRAM',
      '2025-01-01',
      '2025-02-01',
      '2026-10-19',
    );
    expect(plan).toEqual({ fetchFrom: null, fetchTo: null, chunks: [] });
  });

  it('keeps leap-day and year-boundary chunks contiguous and inclusive', () => {
    const plan = planMetaHistory(
      'FACEBOOK',
      '2024-02-29',
      '2025-02-27',
      '2025-02-27',
    );
    const dates = plan.chunks.flatMap((chunk) => {
      const chunkDates: string[] = [];
      const current = new Date(`${chunk.from}T00:00:00.000Z`);
      const end = new Date(`${chunk.to}T00:00:00.000Z`);
      while (current <= end) {
        chunkDates.push(current.toISOString().slice(0, 10));
        current.setUTCDate(current.getUTCDate() + 1);
      }
      return chunkDates;
    });

    expect(plan.fetchFrom).toBe('2024-02-29');
    expect(plan.fetchTo).toBe('2025-02-27');
    expect(dates).toHaveLength(365);
    expect(new Set(dates).size).toBe(365);
    expect(dates).toContain('2024-02-29');
    expect([...dates].sort()).toEqual(
      Array.from({ length: 365 }, (_, index) => {
        const date = new Date('2024-02-29T00:00:00.000Z');
        date.setUTCDate(date.getUTCDate() + index);
        return date.toISOString().slice(0, 10);
      }),
    );
    expect(
      plan.chunks.every((chunk) => {
        const length =
          (Date.parse(`${chunk.to}T00:00:00.000Z`) -
            Date.parse(`${chunk.from}T00:00:00.000Z`)) /
            86_400_000 +
          1;
        return length <= 30;
      }),
    ).toBe(true);
  });
});
