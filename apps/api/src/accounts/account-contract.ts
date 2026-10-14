export const connectedAccountProviders = [
  'INSTAGRAM',
  'FACEBOOK',
  'LINKEDIN',
  'YOUTUBE',
  'ZOHO_CAMPAIGNS',
] as const;

export type ConnectedAccountProvider =
  (typeof connectedAccountProviders)[number];
export type AccountKind = 'SOCIAL' | 'EMAIL';
export type AccountMetricScope = 'DAILY' | 'SNAPSHOT';

export type OAuthCredentials = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  providerData?: Record<string, string>;
};

export type MetricObservation = {
  date: string;
  scope: AccountMetricScope;
  code: string;
  sourceMetric: string;
  value: number;
};

export type PostObservation = {
  externalPostId: string;
  title: string | null;
  postType: string | null;
  permalink: string | null;
  publishedAt: string | null;
  metricValues: Record<string, number>;
  dataScope: 'LIFETIME' | 'DATE_RANGE';
  expiresAt?: string;
};

export type EmailCampaignObservation = {
  externalCampaignId: string;
  campaignName: string;
  sentAt: string | null;
  metricValues: Record<string, number>;
};

export type ProviderSyncResult = {
  metrics: MetricObservation[];
  posts: PostObservation[];
  emailCampaigns: EmailCampaignObservation[];
  caveats: string[];
};

export class AccountProviderFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function providerFailure(code: string, message: string): never {
  throw new AccountProviderFailure(code, message);
}

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    providerFailure(
      'INVALID_PROVIDER_RESPONSE',
      'The provider returned an unsupported response.',
    );
  return value as Record<string, unknown>;
}

export function records(value: unknown): unknown[] {
  if (!Array.isArray(value))
    providerFailure(
      'INVALID_PROVIDER_RESPONSE',
      'The provider returned an unsupported response.',
    );
  return value;
}

export function metricNumber(value: unknown): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).trim() === ''
  )
    providerFailure(
      'INVALID_PROVIDER_METRIC',
      'The provider returned an invalid raw metric.',
    );
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > Number.MAX_SAFE_INTEGER
  )
    providerFailure(
      'INVALID_PROVIDER_METRIC',
      'The provider returned an invalid raw metric.',
    );
  return Number(parsed.toFixed(6));
}

export function validDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    providerFailure(
      'INVALID_PROVIDER_DATE',
      'The provider returned an invalid date.',
    );
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    providerFailure(
      'INVALID_PROVIDER_DATE',
      'The provider returned an invalid date.',
    );
  return value;
}

export function dateFromTimestamp(value: unknown): string {
  const timestamp = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0)
    providerFailure(
      'INVALID_PROVIDER_DATE',
      'The provider returned an invalid date.',
    );
  return new Date(timestamp).toISOString().slice(0, 10);
}
