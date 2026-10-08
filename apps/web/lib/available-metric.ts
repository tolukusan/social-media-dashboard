import type { DashboardResult } from './workspace-types';

/** Chooses a display default from backend values; explicit user choices win. */
export function availableMetric(
  result: DashboardResult | null,
  selected = '',
  channelId = '',
) {
  if (selected) return selected;
  return (
    result?.metricMetadata.find(
      (metric) =>
        (!channelId || metric.applicableChannelIds?.includes(channelId)) &&
        result.kpis[metric.code] !== null &&
        result.kpis[metric.code] !== undefined,
    )?.code ?? ''
  );
}
