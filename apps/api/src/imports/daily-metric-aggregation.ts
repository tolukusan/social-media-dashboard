export type ImportMetricRule = {
  kind: 'RAW' | 'DERIVED';
  aggregationStrategy:
    'SUM' | 'FIRST' | 'LAST' | 'WEIGHTED_AVERAGE' | 'DERIVED';
};

export type WeightedMetricState = Record<
  string,
  { numerator: number; denominator: number }
>;

const weightByMetric: Record<string, string> = {
  SEO_AVG_POSITION: 'SEO_SEARCH_IMPRESSIONS',
};

export function mergeRepeatedDailyMetrics(
  previous: Record<string, number>,
  incoming: Record<string, number>,
  definitions: Map<string, ImportMetricRule>,
  weightedState: WeightedMetricState,
) {
  const result = { ...previous };
  const errors: string[] = [];

  for (const code of Object.keys(incoming)) {
    const rule = definitions.get(code);
    if (
      !rule ||
      rule.kind !== 'RAW' ||
      rule.aggregationStrategy === 'DERIVED' ||
      (rule.aggregationStrategy === 'WEIGHTED_AVERAGE' && !weightByMetric[code])
    )
      errors.push(code);
  }
  if (errors.length) return { values: result, errors };

  for (const [code, value] of Object.entries(incoming)) {
    const rule = definitions.get(code)!;
    if (rule.aggregationStrategy !== 'WEIGHTED_AVERAGE') continue;
    const weightCode = weightByMetric[code]!;
    const weight = incoming[weightCode];
    const state = weightedState[code] ?? {
      numerator:
        previous[code] !== undefined && previous[weightCode] !== undefined
          ? previous[code] * previous[weightCode]
          : 0,
      denominator:
        previous[code] !== undefined && previous[weightCode] !== undefined
          ? previous[weightCode]
          : 0,
    };
    if (weight !== undefined && Number.isFinite(weight) && weight >= 0) {
      state.numerator += value * weight;
      state.denominator += weight;
    }
    weightedState[code] = state;
    if (state.denominator > 0)
      result[code] = state.numerator / state.denominator;
    else delete result[code];
  }

  for (const [code, value] of Object.entries(incoming)) {
    const rule = definitions.get(code)!;
    switch (rule.aggregationStrategy) {
      case 'SUM':
        result[code] = (result[code] ?? 0) + value;
        break;
      case 'FIRST':
        result[code] ??= value;
        break;
      case 'LAST':
        result[code] = value;
        break;
      case 'WEIGHTED_AVERAGE':
        break;
      case 'DERIVED':
        errors.push(code);
        break;
    }
  }
  return { values: result, errors };
}
