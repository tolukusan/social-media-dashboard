import type { DashboardResult } from './workspace-types';

export function formatKpi(result: DashboardResult | null, code: string) {
  const value = result?.kpis[code];
  if (!result || value === null || value === undefined) return '—';
  const unit = result.metricMetadata.find((item) => item.code === code)?.unit;
  if (unit === 'PERCENT') return `${value.toFixed(2)}%`;
  if (unit === 'POSITION') return value.toFixed(2);
  if (unit === 'CURRENCY')
    return result.reportingContext.currencyCode
      ? `${result.reportingContext.currencyCode} ${value.toFixed(2)}`
      : `${value.toFixed(2)} (currency unset)`;
  return String(value);
}

export function formatNumber(result: DashboardResult | null, code: string) {
  const value = result?.kpis[code];
  if (!result || value === null || value === undefined) return '—';
  const unit = result.metricMetadata.find((item) => item.code === code)?.unit;
  if (unit === 'CURRENCY')
    return result.reportingContext.currencyCode
      ? `${result.reportingContext.currencyCode} ${value.toFixed(2)}`
      : `${value.toFixed(2)} (currency unset)`;
  if (unit === 'COUNT') return new Intl.NumberFormat().format(value);
  return String(value);
}
