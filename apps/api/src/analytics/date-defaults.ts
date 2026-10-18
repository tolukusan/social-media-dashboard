export function calendarRangeEnding(to: string) {
  const day = new Date(`${to}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() - 29);
  return { from: day.toISOString().slice(0, 10), to };
}
export function todayInReportingZone(timeZone = 'UTC', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
