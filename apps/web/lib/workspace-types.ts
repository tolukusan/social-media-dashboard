import type { DashboardResponse, TrendResponse } from '@smd/shared';

export type View =
  | 'archive'
  | 'accounts'
  | 'account-insights'
  | 'account-comparison'
  | 'email-reports'
  | 'overview'
  | 'campaigns'
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
