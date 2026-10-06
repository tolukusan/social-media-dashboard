export const API_PREFIX = '/api/v1';

export type HealthResponse = {
  status: 'ok';
  service: string;
  timestamp: string;
};

export type MetricUnit =
  'COUNT' | 'PERCENT' | 'CURRENCY' | 'POSITION' | 'DECIMAL';
export type MetricKind = 'RAW' | 'DERIVED';
export type AggregationStrategy =
  'SUM' | 'FIRST' | 'LAST' | 'WEIGHTED_AVERAGE' | 'DERIVED';

export type AnalyticsFilters = {
  from: string | null;
  to: string | null;
  campaignId: string | null;
  channelId: string | null;
  platformId: string | null;
  metricCode: string | null;
  targetPeriod?: string | null;
};

export type AnalyticsMetricMetadata = {
  code: string;
  label: string;
  unit: MetricUnit;
  kind: MetricKind;
  aggregationStrategy: AggregationStrategy;
  applicableChannelIds?: string[];
  aggregationNote?: string;
};

export type AnalyticsTargetEvaluation = {
  actual: number | null;
  target: {
    id: string;
    value: number;
    comparisonRule: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
    scopeType: 'GLOBAL' | 'CHANNEL' | 'PLATFORM' | 'CAMPAIGN';
    periodType: string;
    effectiveFrom: string;
    effectiveTo: string | null;
  } | null;
  status: 'NO_TARGET' | 'NO_DATA' | 'MEETS_TARGET' | 'MISSES_TARGET' | null;
  statusDecisionRequired?: boolean;
};

export type DashboardResponse = {
  filters: AnalyticsFilters;
  recordCount: number;
  campaignCount: number;
  channelCount: number;
  rawTotals: Record<string, number | null>;
  derived: Record<string, number | null>;
  /** Compatibility map for existing dashboard/report consumers. */
  kpis: Record<string, number | null>;
  metricMetadata: AnalyticsMetricMetadata[];
  targetEvaluations?: Record<string, AnalyticsTargetEvaluation>;
  reportingContext: { currencyCode: string | null; timeZone: string | null };
};

export type TrendResponse = {
  grain: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  points: Array<{
    bucket: string;
    rawTotals: Record<string, number | null>;
    derived: Record<string, number | null>;
    kpis: Record<string, number | null>;
  }>;
};
