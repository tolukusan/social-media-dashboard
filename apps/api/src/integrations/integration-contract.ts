export const providers = [
  'FACEBOOK_ADS',
  'INSTAGRAM_ADS',
  'LINKEDIN_ADS',
  'ZOHO_CAMPAIGNS',
] as const;
export type Provider = (typeof providers)[number];
export const regions = ['US', 'EU', 'IN', 'AU', 'JP', 'CN'] as const;
export const zohoHosts: Record<string, string> = {
  US: 'campaigns.zoho.com',
  EU: 'campaigns.zoho.eu',
  IN: 'campaigns.zoho.in',
  AU: 'campaigns.zoho.com.au',
  JP: 'campaigns.zoho.jp',
  CN: 'campaigns.zoho.com.cn',
};
export type SourceConnection = {
  provider: Provider;
  externalAccountId: string;
  credentialReference: string;
  sourceTimezone: string;
  currency: string | null;
  region: string;
};
export type DailyObservation = { date: string; values: Record<string, number> };
export type CampaignSnapshot = {
  externalCampaignId: string;
  scope: 'CUMULATIVE_CAMPAIGN';
  values: Record<string, number>;
};
export type ProviderResult = {
  observations: DailyObservation[];
  snapshot?: CampaignSnapshot;
};

export class IntegrationFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function fail(code: string, message: string): never {
  throw new IntegrationFailure(code, message);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail(
      'INVALID_PROVIDER_RESPONSE',
      'The provider returned an unsupported response.',
    );
  return value as Record<string, unknown>;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value))
    fail(
      'INVALID_PROVIDER_RESPONSE',
      'The provider returned an unsupported response.',
    );
  return value;
}
export function numeric(value: unknown, count = true): number {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    String(value).trim() === ''
  )
    fail(
      'INVALID_PROVIDER_METRIC',
      'The provider returned an invalid raw metric.',
    );
  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed < 0 ||
    parsed > Number.MAX_SAFE_INTEGER ||
    (count && !Number.isSafeInteger(parsed))
  )
    fail(
      'INVALID_PROVIDER_METRIC',
      'The provider returned an invalid raw metric.',
    );
  return count ? parsed : Number(parsed.toFixed(6));
}
export function day(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail(
      'INVALID_PROVIDER_DATE',
      'Daily data must contain a valid calendar date.',
    );
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    fail(
      'INVALID_PROVIDER_DATE',
      'Daily data must contain a valid calendar date.',
    );
  return value;
}
export function sourceToday(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function shiftDay(value: string, days: number): string {
  const date = new Date(`${day(value)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function configuration(connection: SourceConnection): {
  ready: boolean;
  code: string | null;
} {
  if (
    !/^INTEGRATION_[A-Z0-9_]+_ACCESS_TOKEN$/.test(
      connection.credentialReference,
    ) ||
    !process.env[connection.credentialReference]?.trim()
  )
    return { ready: false, code: 'CREDENTIALS_REQUIRED' };
  if (
    connection.provider.includes('FACEBOOK') ||
    connection.provider.includes('INSTAGRAM')
  ) {
    if (!/^v\d+\.\d+$/.test(process.env.INTEGRATION_META_API_VERSION ?? ''))
      return { ready: false, code: 'API_VERSION_REQUIRED' };
  }
  if (
    connection.provider === 'LINKEDIN_ADS' &&
    !/^\d{6}$/.test(process.env.INTEGRATION_LINKEDIN_API_VERSION ?? '')
  )
    return { ready: false, code: 'API_VERSION_REQUIRED' };
  return { ready: true, code: null };
}
