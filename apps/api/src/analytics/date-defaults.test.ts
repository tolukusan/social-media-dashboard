import { test, expect } from 'vitest';
import { calendarRangeEnding, todayInReportingZone } from './date-defaults.js';
test('date-only rolling range includes 30 days and ignores host/DST offsets', () => {
  expect(calendarRangeEnding('2026-10-10')).toEqual({
    from: '2026-09-11',
    to: '2026-10-10',
  });
  expect(calendarRangeEnding('2024-03-01')).toEqual({
    from: '2024-02-01',
    to: '2024-03-01',
  });
  expect(
    todayInReportingZone('America/New_York', new Date('2026-01-01T01:00:00Z')),
  ).toBe('2025-12-31');
});
