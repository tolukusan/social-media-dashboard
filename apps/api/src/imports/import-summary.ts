import type { NormalizedImportRow } from './import.types.js';

/** Describes accepted canonical rows; never calculates KPI values. */
export function summarizeImport(rows: NormalizedImportRow[]) {
  const canonical = rows.filter((row) => !row.mergedIntoSourceRowNumber);
  const campaigns = new Map<
    string,
    {
      campaignId: string;
      platformId: string;
      from: string;
      to: string;
      metricCodes: string[];
      dailyRecords: number;
      unchangedRecords: number;
    }
  >();
  for (const row of canonical) {
    const key = `${row.campaignId}:${row.platformId}`;
    const codes = Object.keys(row.metrics);
    const scope = campaigns.get(key) ?? {
      campaignId: row.campaignId,
      platformId: row.platformId,
      from: row.recordDate,
      to: row.recordDate,
      metricCodes: [],
      dailyRecords: 0,
      unchangedRecords: 0,
    };
    scope.from = row.recordDate < scope.from ? row.recordDate : scope.from;
    scope.to = row.recordDate > scope.to ? row.recordDate : scope.to;
    scope.metricCodes = [...new Set([...scope.metricCodes, ...codes])];
    scope.dailyRecords += 1;
    if (!codes.length) scope.unchangedRecords += 1;
    campaigns.set(key, scope);
  }
  return {
    dailyRecords: canonical.length,
    unchangedRecords: canonical.filter(
      (row) => !Object.keys(row.metrics).length,
    ).length,
    scopes: [...campaigns.values()],
  };
}
