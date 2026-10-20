export type AccountMetricCoverage = {
  status: 'COMPLETE' | 'PARTIAL' | 'NONE';
  requestedDays: number;
  observedDays: number;
  firstObservedDate: string | null;
  lastObservedDate: string | null;
};

export function accountMetricCoverage(
  observations: Array<{ date: string; value: number }>,
  from: string,
  to: string,
): AccountMetricCoverage {
  const requestedDays =
    Math.floor(
      (Date.parse(`${to}T00:00:00.000Z`) -
        Date.parse(`${from}T00:00:00.000Z`)) /
        86_400_000,
    ) + 1;
  const dates = [
    ...new Set(
      observations
        .filter(
          (observation) =>
            Number.isFinite(observation.value) &&
            observation.date >= from &&
            observation.date <= to,
        )
        .map((observation) => observation.date),
    ),
  ].sort();
  const observedDays = dates.length;
  return {
    status:
      observedDays === 0
        ? 'NONE'
        : observedDays === requestedDays
          ? 'COMPLETE'
          : 'PARTIAL',
    requestedDays,
    observedDays,
    firstObservedDate: dates[0] ?? null,
    lastObservedDate: dates.at(-1) ?? null,
  };
}
