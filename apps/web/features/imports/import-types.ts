export const destinations = [
  ['recordDate', 'Record date'],
  ['campaignName', 'Campaign name'],
  ['SM_REACH', 'Social reach'],
  ['SM_IMPRESSIONS', 'Social impressions'],
  ['SM_ENGAGEMENTS', 'Social engagements'],
  ['SM_LINK_CLICKS', 'Social link clicks'],
  ['SM_FOLLOWERS_GAINED', 'Followers gained'],
  ['SM_VIEWS', 'Social views'],
  ['SM_PROFILE_VISITS', 'Profile/page visits'],
  ['SM_VIEWERS', 'Unique viewers'],
  ['EMAIL_SENT', 'Emails sent'],
  ['EMAIL_DELIVERED', 'Emails delivered'],
  ['EMAIL_OPENS', 'Email opens'],
  ['EMAIL_CLICKS', 'Email clicks'],
  ['EMAIL_UNSUBSCRIBES', 'Unsubscribes'],
  ['EMAIL_BOUNCES', 'Bounces'],
  ['EMAIL_HARD_BOUNCES', 'Hard bounces'],
  ['EMAIL_SOFT_BOUNCES', 'Soft bounces'],
  ['EMAIL_SPAM_COMPLAINTS', 'Spam complaints'],
];

export type Preview = {
  id: string;
  filename: string;
  format: string;
  checksum: string;
  displayName: string;
  duplicateCompleted: boolean;
  source: { type: string; platform: string | null };
  sheets: string[];
  columns: string[];
  rowCount: number;
  sampleRows: Array<{ sourceRowNumber: number; data: Record<string, unknown> }>;
  campaignValues: string[];
  matchingTemplate?: {
    displayName: string;
    mapping: Record<string, string>;
  };
  suggestedMapping: Record<string, string>;
  warnings: string[];
  sheet?: string;
  dateRange: { from: string; to: string } | null;
  sheetPreviews: Array<
    Omit<
      Preview,
      | 'sheetPreviews'
      | 'id'
      | 'filename'
      | 'format'
      | 'checksum'
      | 'displayName'
      | 'duplicateCompleted'
      | 'sheets'
      | 'warnings'
    >
  >;
};
export type Campaign = { id: string; name: string };
export type Platform = {
  id: string;
  name: string;
  code?: string;
  active?: boolean;
  channel?: { id: string; name: string; active?: boolean };
};
export type Channel = {
  id: string;
  name: string;
  code?: string;
  active?: boolean;
  platforms: Array<{ id: string; name: string; active?: boolean }>;
};
export type HistoryItem = {
  id: string;
  displayName?: string | null;
  originalFilename: string;
  sourcePlatform?: string | null;
  status: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  createdAt: string;
  importedByUser?: { name: string };
  currentCampaignNames: string[];
  deletedCampaignCount: number;
};
export type Result = {
  id: string;
  status: string;
  totalRows: number;
  acceptedRows: number;
  rejectedRows: number;
  warningCount: number;
  summary: ImportSummary;
  rows: Array<{
    sourceRowNumber?: number;
    status: string;
    errors: Array<{ code?: string; message: string }>;
    warnings: Array<{ message: string }>;
  }>;
};

export type ImportScope = {
  campaignId: string;
  platformId: string;
  from: string;
  to: string;
  metricCodes: string[];
  dailyRecords: number;
  unchangedRecords: number;
};
export type ImportSummary = {
  dailyRecords: number;
  unchangedRecords: number;
  scopes: ImportScope[];
};
