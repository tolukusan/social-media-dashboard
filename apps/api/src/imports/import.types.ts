export type ImportCell = string | number | boolean | null;

export type ParsedImportRow = {
  sourceRowNumber: number;
  sheetName?: string;
  data: Record<string, ImportCell>;
};

export type ParsedImportFile = {
  format: 'CSV' | 'JSON' | 'XLSX';
  sheets: string[];
  rows: ParsedImportRow[];
  columns: string[];
};

export type NormalizedImportRow = {
  sourceRowNumber: number;
  sheetName?: string;
  recordDate: string;
  campaignId: string;
  platformId: string;
  metrics: Record<string, number>;
  mergedIntoSourceRowNumber?: number;
  sourceRecordId?: string;
  campaignName?: string;
};

export type RowIssue = { code: string; message: string };
