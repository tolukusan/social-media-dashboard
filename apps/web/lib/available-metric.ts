import type { DashboardResult } from './workspace-types';

/** Chooses a display default from backend values; explicit user choices win. */
export function availableMetric(
  result: DashboardResult | null,
  selected = '',
  channelId = '',
) {
  if (selected) return selected;
  const candidates =
    result?.metricMetadata.filter(
      (metric) =>
        (!channelId || metric.applicableChannelIds?.includes(channelId)) &&
        result.kpis[metric.code] != null,
    ) ?? [];
  const preferred = ['SM_ENGAGEMENTS', 'EMAIL_OPENS'].find((code) =>
    candidates.some((metric) => metric.code === code),
  );
  if (preferred) return preferred;
  return (
    result?.metricMetadata.find(
      (metric) =>
        (!channelId || metric.applicableChannelIds?.includes(channelId)) &&
        result.kpis[metric.code] !== null &&
        result.kpis[metric.code] !== undefined,
    )?.code ?? ''
  );
}
