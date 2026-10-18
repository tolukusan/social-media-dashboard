import type { DashboardResponse, TrendResponse } from '@smd/shared';

export type View =
  | 'archive'
  | 'accounts'
  | 'account-insights'
  | 'account-comparison'
  | 'email-reports'
  | 'overview'
  | 'campaigns'
  | 'datasets'
  | 'performance'
  | 'analytics'
  | 'targets'
  | 'reports'
  | 'users'
  | 'settings'
  | 'integrations'
  | 'profile';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export type DashboardResult = DashboardResponse;
export type TrendResult = TrendResponse;

export type Campaign = {
  id: string;
  name: string;
  description?: string | null;
  objective?: string | null;
  targetAudience?: string | null;
  budget?: number | string | null;
  status: string;
  startDate: string;
  endDate?: string | null;
  notes?: string | null;
  responsibleUser?: { id: string; name: string; email?: string };
  archivedAt?: string | null;
  campaignChannels?: Array<{
    id?: string;
    channel: { id?: string; name: string; active?: boolean };
    campaignPlatforms?: Array<{
      id?: string;
      platform: { id?: string; name: string; active?: boolean };
    }>;
  }>;
};

export type Channel = {
  id: string;
  code?: string;
  name: string;
  description?: string | null;
  active?: boolean;
  platforms: Array<{
    id: string;
    description?: string | null;
    name: string;
    active?: boolean;
    code?: string;
  }>;
};

export type DatasetColumnType =
  'text' | 'number' | 'boolean' | 'date' | 'mixed';

export type DatasetColumn = {
  id: string;
  ordinal: number;
  originalName: string;
  label: string;
  type: DatasetColumnType;
  dateLike: boolean;
  meaning?: string | null;
  unit?: string | null;
};

export type DatasetComparisonResult = {
  campaignId: string;
  left: {
    datasetId: string;
    revision: number;
    datasetName: string;
    sourceFilename: string;
    columnId: string;
    columnLabel: string;
    originalName: string;
    meaning: string | null;
    unit: string | null;
    dateColumnId: string | null;
  };
  right: {
    datasetId: string;
    revision: number;
    datasetName: string;
    sourceFilename: string;
    columnId: string;
    columnLabel: string;
    originalName: string;
    meaning: string | null;
    unit: string | null;
    dateColumnId: string | null;
  };
  chart: {
    eligible: boolean;
    reason: string | null;
    intervalMilliseconds: number | null;
  };
};

export type DatasetCapabilities = {
  view: boolean;
  replace: boolean;
  delete: boolean;
};

export type DatasetCard = {
  id: string;
  campaignId: string;
  name: string;
  sourceFilename: string;
  worksheetName: string | null;
  managementCapability: 'MANAGEABLE' | 'HISTORICAL_PROTECTED';
  version: number;
  currentRevision: number;
  rowCount: number;
  createdAt: string;
  capabilities: DatasetCapabilities;
  explanation?: string;
};

export type HistoricalImport = {
  id: string;
  name: string;
  sourceFilename: string;
  worksheetName: string | null;
  availableRecordCount: number;
  importedAt: string;
  originalFileAvailable: false;
  note: string;
  managementCapability: 'HISTORICAL_PROTECTED';
  explanation: string;
};

export type DatasetCampaignResult = {
  campaign: { id: string; name: string };
  datasets: DatasetCard[];
  historicalImports: HistoricalImport[];
};

export type DatasetDetail = DatasetCard & {
  campaign: { id: string; name: string };
  headerFingerprint: string;
  columns: DatasetColumn[];
  sourceFilename: string;
  importedAt: string;
};

export type DatasetRowsResult = {
  datasetId: string;
  revision: number;
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
  rows: Array<{
    id: string;
    sourceRowNumber: number;
    cells: unknown[];
    typedCells: Array<{ kind: string; value: unknown }>;
  }>;
};

export type DatasetImportSheet = {
  key: string;
  name: string;
  rowCount: number;
  columns?: DatasetColumn[];
  headerFingerprint?: string;
};

export type DatasetImportAttempt = {
  id: string;
  filename: string;
  operation: 'CREATE' | 'REPLACE';
  targetDatasetId: string | null;
  expectedVersion: number | null;
  status: string;
  sheetSelectionRequired: boolean;
  selectedSheet: string | null;
  sheets: DatasetImportSheet[];
  selected:
    | (DatasetImportSheet & {
        sampleRows: Array<{ sourceRowNumber: number; cells: unknown[] }>;
      })
    | null;
  duplicate: {
    dataset: DatasetCard;
    actions: { view: boolean; replace: boolean };
  } | null;
  matchingTemplates?: Array<{
    id: string;
    name: string;
    rules: { columns?: Array<{ id: string; label: string }> };
  }>;
};

export type DatasetHistoryDetail = {
  id: string;
  campaignId: string;
  name: string;
  sourceFilename: string;
  worksheetName: string | null;
  importedAt: string;
  originalFileAvailable: false;
  note: string;
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  rows: Array<{
    id: string;
    date: string;
    status: string;
    channel: string;
    platform: string;
    values: Array<{
      code: string;
      name: string;
      unit: string;
      value: string;
    }>;
  }>;
};

export type PerformanceRecord = {
  id: string;
  recordDate: string;
  notes?: string | null;
  status?: string;
  campaignPlatform?: {
    id?: string;
    platform?: { id?: string; name: string; active?: boolean };
    campaignChannel?: {
      channelId?: string;
      campaign?: {
        id?: string;
        name: string;
        startDate?: string;
        endDate?: string | null;
        archivedAt?: string | null;
      };
      channel?: { id?: string; name: string; active?: boolean };
    };
  };
  importBatch?: {
    displayName?: string | null;
    originalFilename?: string;
  } | null;
  integrationManaged?: boolean;
  integrationMapping?: {
    externalCampaignId: string;
    connection: { displayName: string; provider: string };
  } | null;
  metricValues?: Array<{
    value: number | string;
    metricDefinition?: { code: string; name: string };
  }>;
};

export type ChannelMetric = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  unit: string;
  kind: 'RAW' | 'DERIVED';
  active: boolean;
  inputEnabled: boolean;
  displayOrder: number;
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role: { code: string; name: string };
};

export type ManagedUser = Omit<CurrentUser, 'role'> & {
  role: { id: string; code: string; name: string };
  deactivatedAt?: string | null;
};

export type UserRole = { id: string; code: string; name: string };

export type KpiTargetDefinition = {
  id: string;
  name: string;
  description?: string | null;
  metricDefinition: { code: string; unit: string; kind: string };
};

export type KpiTarget = {
  id: string;
  kpiDefinitionId: string;
  periodType: string;
  targetValue: number | string;
  scopeType: 'GLOBAL' | 'CHANNEL' | 'PLATFORM' | 'CAMPAIGN';
  channelId: string | null;
  platformId: string | null;
  campaignId: string | null;
  comparisonRule: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
  effectiveFrom: string;
  effectiveTo: string | null;
  kpiDefinition: KpiTargetDefinition;
  channel?: { name: string } | null;
  platform?: { name: string } | null;
  campaign?: { name: string } | null;
};
