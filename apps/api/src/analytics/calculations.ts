export type RawMetricRow = Record<string, number | null | undefined>;
export type CalculatedKpis = Record<string, number | null>;
export type MetricCalculationDefinition = {
  code: string;
  name: string;
  kind: 'RAW' | 'DERIVED';
  unit: 'COUNT' | 'PERCENT' | 'CURRENCY' | 'POSITION' | 'DECIMAL';
  aggregationStrategy:
    'SUM' | 'FIRST' | 'LAST' | 'WEIGHTED_AVERAGE' | 'DERIVED';
};
export type CalculationResult = {
  rawTotals: CalculatedKpis;
  derived: CalculatedKpis;
  kpis: CalculatedKpis;
};
export type TargetCandidate = {
  id: string;
  scopeType: 'GLOBAL' | 'CHANNEL' | 'PLATFORM' | 'CAMPAIGN';
  channelId?: string | null;
  platformId?: string | null;
  campaignId?: string | null;
  periodType: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  targetValue: number;
  comparisonRule: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
};

const scopeRank = { GLOBAL: 0, CHANNEL: 1, PLATFORM: 2, CAMPAIGN: 3 } as const;

export function resolveTarget(
  targets: TargetCandidate[],
  context: { campaignId?: string; channelId?: string; platformId?: string },
  periodType: string,
  evaluationDate: Date,
  evaluationPeriod?: { from: Date; to: Date },
) {
  const evaluationEnd = evaluationPeriod
    ? new Date(
        Date.UTC(
          evaluationPeriod.to.getUTCFullYear(),
          evaluationPeriod.to.getUTCMonth(),
          evaluationPeriod.to.getUTCDate(),
        ),
      )
    : evaluationDate;
  return (
    [...targets]
      .filter(
        (target) =>
          target.periodType === periodType &&
          target.effectiveFrom <= (evaluationPeriod?.from ?? evaluationDate) &&
          (!target.effectiveTo || target.effectiveTo >= evaluationEnd) &&
          (target.scopeType === 'GLOBAL' ||
            (target.scopeType === 'CHANNEL' &&
              target.channelId === context.channelId) ||
            (target.scopeType === 'PLATFORM' &&
              target.platformId === context.platformId) ||
            (target.scopeType === 'CAMPAIGN' &&
              target.campaignId === context.campaignId)),
      )
      .sort(
        (left, right) => scopeRank[right.scopeType] - scopeRank[left.scopeType],
      )[0] ?? null
  );
}

export function targetStatus(
  actual: number | null,
  target: TargetCandidate | null,
) {
  if (actual === null) return 'NO_DATA' as const;
  if (!target) return 'NO_TARGET' as const;
  return (
    target.comparisonRule === 'HIGHER_IS_BETTER'
      ? actual >= target.targetValue
      : actual <= target.targetValue
  )
    ? ('MEETS_TARGET' as const)
    : ('MISSES_TARGET' as const);
}

export type TrendGrain = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type ComparisonPeriodType = 'CUSTOM' | 'MONTH' | 'QUARTER' | 'YEAR';

export function trendGrain(from: Date, to: Date): TrendGrain {
  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return days <= 31 ? 'DAILY' : days <= 120 ? 'WEEKLY' : 'MONTHLY';
}

export function comparisonPeriods(
  from: Date,
  to: Date,
  type: ComparisonPeriodType = 'CUSTOM',
) {
  const dayMs = 86_400_000;
  const dayStart = (date: Date) =>
    new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  const dayEnd = (date: Date) => new Date(dayStart(date).getTime() + dayMs - 1);
  const currentTo = new Date(to);
  let currentFrom = new Date(from);
  let previousFrom: Date;
  let previousTo: Date;
  let currentPeriodEnd = new Date(to);
  if (type === 'MONTH') {
    currentFrom = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    currentPeriodEnd = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth() + 1, 0),
    );
    previousFrom = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 1, 1),
    );
    const elapsed = Math.floor(
      (currentTo.getTime() - currentFrom.getTime()) / 86_400_000,
    );
    const previousMonthEnd = new Date(
      Date.UTC(
        previousFrom.getUTCFullYear(),
        previousFrom.getUTCMonth() + 1,
        0,
      ),
    );
    previousTo = dayEnd(
      new Date(
        Math.min(
          previousFrom.getTime() + elapsed * dayMs,
          previousMonthEnd.getTime(),
        ),
      ),
    );
  } else if (type === 'QUARTER') {
    const quarterStartMonth = Math.floor(to.getUTCMonth() / 3) * 3;
    currentFrom = new Date(Date.UTC(to.getUTCFullYear(), quarterStartMonth, 1));
    currentPeriodEnd = new Date(
      Date.UTC(to.getUTCFullYear(), quarterStartMonth + 3, 0),
    );
    previousFrom = new Date(
      Date.UTC(to.getUTCFullYear(), quarterStartMonth - 3, 1),
    );
    const elapsed = Math.floor(
      (currentTo.getTime() - currentFrom.getTime()) / 86_400_000,
    );
    const previousEnd = new Date(
      Date.UTC(
        previousFrom.getUTCFullYear(),
        previousFrom.getUTCMonth() + 3,
        0,
      ),
    );
    previousTo = dayEnd(
      new Date(
        Math.min(
          previousFrom.getTime() + elapsed * dayMs,
          previousEnd.getTime(),
        ),
      ),
    );
  } else if (type === 'YEAR') {
    currentFrom = new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
    currentPeriodEnd = new Date(Date.UTC(to.getUTCFullYear(), 11, 31));
    previousFrom = new Date(Date.UTC(to.getUTCFullYear() - 1, 0, 1));
    const elapsed = Math.floor(
      (currentTo.getTime() - currentFrom.getTime()) / 86_400_000,
    );
    const previousEnd = new Date(
      Date.UTC(previousFrom.getUTCFullYear(), 11, 31),
    );
    previousTo = dayEnd(
      new Date(
        Math.min(
          previousFrom.getTime() + elapsed * dayMs,
          previousEnd.getTime(),
        ),
      ),
    );
  } else {
    const currentFromDay = dayStart(from);
    const currentToDay = dayStart(to);
    const days =
      Math.floor((currentToDay.getTime() - currentFromDay.getTime()) / dayMs) +
      1;
    previousTo = dayEnd(new Date(currentFromDay.getTime() - dayMs));
    previousFrom = dayStart(
      new Date(previousTo.getTime() - (days - 1) * dayMs),
    );
  }
  const isPartial =
    dayStart(currentTo).getTime() < dayStart(currentPeriodEnd).getTime();
  return {
    type,
    isPartial,
    current: { from: currentFrom, to: currentTo },
    previous: { from: previousFrom, to: previousTo },
  };
}

export function percentageChange(
  current: number | null,
  previous: number | null,
) {
  if (current === null || previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function valuesFor(rows: RawMetricRow[], code: string) {
  return rows
    .map((row) => row[code])
    .filter(
      (value): value is number =>
        typeof value === 'number' && Number.isFinite(value),
    );
}

function sum(rows: RawMetricRow[], code: string) {
  const values = valuesFor(rows, code);
  return values.length
    ? values.reduce((total, value) => total + value, 0)
    : null;
}

function weightedAverage(
  rows: RawMetricRow[],
  code: string,
  weightCode: string,
) {
  let numerator = 0;
  let denominator = 0;
  let hasPair = false;
  for (const row of rows) {
    const value = row[code];
    const weight = row[weightCode];
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight < 0
    )
      continue;
    hasPair = true;
    numerator += value * weight;
    denominator += weight;
  }
  return !hasPair || denominator === 0 ? null : numerator / denominator;
}

function aggregateMetric(
  rows: RawMetricRow[],
  definition: MetricCalculationDefinition,
) {
  switch (definition.aggregationStrategy) {
    case 'SUM':
      return sum(rows, definition.code);
    case 'FIRST':
      return valuesFor(rows, definition.code)[0] ?? null;
    case 'LAST':
      return valuesFor(rows, definition.code).at(-1) ?? null;
    case 'WEIGHTED_AVERAGE':
      // The approved catalogue currently defines only SEO average position,
      // weighted by search impressions. No weight is approved for other codes.
      return definition.code === 'SEO_AVG_POSITION'
        ? weightedAverage(rows, definition.code, 'SEO_SEARCH_IMPRESSIONS')
        : null;
    case 'DERIVED':
      return null;
    default:
      return null;
  }
}

function ratio(
  numerator: number | null,
  denominator: number | null,
  multiplier = 1,
) {
  return numerator === null || denominator === null || denominator === 0
    ? null
    : (numerator / denominator) * multiplier;
}

export function calculateKpis(
  rows: RawMetricRow[],
  definitions: MetricCalculationDefinition[],
): CalculationResult {
  const rawDefinitions = definitions.filter((item) => item.kind === 'RAW');
  const rawTotals: CalculatedKpis = Object.fromEntries(
    rawDefinitions.map((definition) => [
      definition.code,
      aggregateMetric(rows, definition),
    ]),
  );
  const value = (code: string) => rawTotals[code] ?? null;
  const derived: CalculatedKpis = {
    SM_ENGAGEMENT_RATE: ratio(value('SM_ENGAGEMENTS'), value('SM_REACH'), 100),
    SM_CTR: ratio(value('SM_LINK_CLICKS'), value('SM_IMPRESSIONS'), 100),
    WEB_CONVERSION_RATE: ratio(
      value('WEB_CONVERSIONS'),
      value('WEB_SESSIONS'),
      100,
    ),
    EMAIL_OPEN_RATE: ratio(value('EMAIL_OPENS'), value('EMAIL_DELIVERED'), 100),
    EMAIL_CTR: ratio(value('EMAIL_CLICKS'), value('EMAIL_DELIVERED'), 100),
    EMAIL_CONVERSION_RATE: ratio(
      value('EMAIL_CONVERSIONS'),
      value('EMAIL_CLICKS'),
      100,
    ),
    ADS_CTR: ratio(value('ADS_CLICKS'), value('ADS_IMPRESSIONS'), 100),
    ADS_CPC: ratio(value('ADS_SPEND'), value('ADS_CLICKS')),
    ADS_CONVERSION_RATE: ratio(
      value('ADS_CONVERSIONS'),
      value('ADS_CLICKS'),
      100,
    ),
    SEO_CTR: ratio(
      value('SEO_SEARCH_CLICKS'),
      value('SEO_SEARCH_IMPRESSIONS'),
      100,
    ),
    SEO_AVG_POSITION: value('SEO_AVG_POSITION'),
  };
  const derivedCodes = new Set(
    definitions
      .filter((item) => item.kind === 'DERIVED')
      .map((item) => item.code),
  );
  const approvedDerived = Object.fromEntries(
    Object.entries(derived).filter(([code]) => derivedCodes.has(code)),
  );
  return {
    rawTotals,
    derived: approvedDerived,
    kpis: { ...rawTotals, ...approvedDerived },
  };
}
