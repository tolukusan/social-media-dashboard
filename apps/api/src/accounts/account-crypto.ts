import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import type {
  ConnectedAccountProvider,
  OAuthCredentials,
} from './account-contract.js';
import { AccountProviderFailure, providerFailure } from './account-contract.js';

const aad = Buffer.from('marketwise-connected-account-v1', 'utf8');

function encryptionKey() {
  const raw = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  try {
    const key = Buffer.from(raw, 'base64');
    return key.length === 32 && key.toString('base64') === raw ? key : null;
  } catch {
    return null;
  }
}

export function encryptCredentials(credentials: OAuthCredentials): string {
  const key = encryptionKey();
  if (!key)
    providerFailure(
      'TOKEN_ENCRYPTION_NOT_CONFIGURED',
      'The integration encryption key is not configured.',
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptCredentials(envelope: string): OAuthCredentials {
  const key = encryptionKey();
  if (!key)
    providerFailure(
      'TOKEN_ENCRYPTION_NOT_CONFIGURED',
      'The integration encryption key is not configured.',
    );
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
    envelope.split('.');
  if (
    version !== 'v1' ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra !== undefined
  )
    providerFailure(
      'TOKEN_DECRYPTION_FAILED',
      'The saved provider connection could not be read. Reconnect the account.',
    );
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(encodedIv, 'base64url'),
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const parsed = JSON.parse(clear) as Partial<OAuthCredentials>;
    if (typeof parsed.accessToken !== 'string' || !parsed.accessToken)
      throw new Error('Invalid credential payload');
    return {
      accessToken: parsed.accessToken,
      ...(typeof parsed.refreshToken === 'string'
        ? { refreshToken: parsed.refreshToken }
        : {}),
      ...(typeof parsed.expiresAt === 'string'
        ? { expiresAt: parsed.expiresAt }
        : {}),
      ...(parsed.providerData && typeof parsed.providerData === 'object'
        ? { providerData: parsed.providerData as Record<string, string> }
        : {}),
    };
  } catch {
    providerFailure(
      'TOKEN_DECRYPTION_FAILED',
      'The saved provider connection could not be read. Reconnect the account.',
    );
  }
}

export function hashOAuthState(state: string) {
  return createHash('sha256').update(state).digest('hex');
}

export function newOAuthState() {
  return randomBytes(32).toString('base64url');
}

export type ProviderSetup = {
  ready: boolean;
  missing: string[];
  accountKind: 'SOCIAL' | 'EMAIL';
  scopes: string[];
  notes: string[];
};

const sharedConfig = [
  'INTEGRATION_OAUTH_REDIRECT_URI',
  'INTEGRATION_TOKEN_ENCRYPTION_KEY',
];

const providerConfig: Record<
  ConnectedAccountProvider,
  Omit<ProviderSetup, 'ready' | 'missing'>
> = {
  INSTAGRAM: {
    accountKind: 'SOCIAL',
    scopes: [
      'pages_show_list',
      'pages_read_engagement',
      'read_insights',
      'instagram_basic',
      'instagram_manage_insights',
    ],
    notes: [
      'Instagram Business or Creator accounts linked to a Facebook Page are supported.',
    ],
  },
  FACEBOOK: {
    accountKind: 'SOCIAL',
    scopes: ['pages_show_list', 'pages_read_engagement', 'read_insights'],
    notes: [
      'Facebook Page Insights require an eligible Page role and app permissions.',
    ],
  },
  LINKEDIN: {
    accountKind: 'SOCIAL',
    scopes: [
      'openid',
      'profile',
      'rw_organization_admin',
      'r_organization_social',
    ],
    notes: [
      'LinkedIn Community Management API approval and organization administrator access are required. This app only calls read endpoints.',
    ],
  },
  YOUTUBE: {
    accountKind: 'SOCIAL',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ],
    notes: [
      'YouTube Data API and YouTube Analytics API must be enabled in the Google project.',
    ],
  },
  ZOHO_CAMPAIGNS: {
    accountKind: 'EMAIL',
    scopes: ['ZohoCampaigns.campaign.READ'],
    notes: [
      'Email reports are cumulative campaign snapshots, not daily social activity.',
    ],
  },
};

export function providerSetup(
  provider: ConnectedAccountProvider,
  env = process.env,
): ProviderSetup {
  const missing = sharedConfig.filter((name) => !env[name]?.trim());
  const required: Record<ConnectedAccountProvider, string[]> = {
    INSTAGRAM: [
      'INTEGRATION_META_APP_ID',
      'INTEGRATION_META_APP_SECRET',
      'INTEGRATION_META_API_VERSION',
    ],
    FACEBOOK: [
      'INTEGRATION_META_APP_ID',
      'INTEGRATION_META_APP_SECRET',
      'INTEGRATION_META_API_VERSION',
    ],
    LINKEDIN: [
      'INTEGRATION_LINKEDIN_CLIENT_ID',
      'INTEGRATION_LINKEDIN_CLIENT_SECRET',
      'INTEGRATION_LINKEDIN_API_VERSION',
    ],
    YOUTUBE: [
      'INTEGRATION_GOOGLE_CLIENT_ID',
      'INTEGRATION_GOOGLE_CLIENT_SECRET',
    ],
    ZOHO_CAMPAIGNS: [
      'INTEGRATION_ZOHO_CLIENT_ID',
      'INTEGRATION_ZOHO_CLIENT_SECRET',
      'INTEGRATION_ZOHO_REGION',
    ],
  };
  for (const name of required[provider]) {
    if (!env[name]?.trim()) missing.push(name);
  }
  if (provider === 'INSTAGRAM' || provider === 'FACEBOOK') {
    if (
      env.INTEGRATION_META_API_VERSION &&
      !/^v\d+\.\d+$/.test(env.INTEGRATION_META_API_VERSION)
    )
      missing.push('INTEGRATION_META_API_VERSION_FORMAT');
  }
  if (
    provider === 'LINKEDIN' &&
    env.INTEGRATION_LINKEDIN_API_VERSION &&
    !/^\d{6}$/.test(env.INTEGRATION_LINKEDIN_API_VERSION)
  )
    missing.push('INTEGRATION_LINKEDIN_API_VERSION_FORMAT');
  if (
    provider === 'ZOHO_CAMPAIGNS' &&
    env.INTEGRATION_ZOHO_REGION &&
    !['US', 'EU', 'IN', 'AU', 'JP', 'CN'].includes(env.INTEGRATION_ZOHO_REGION)
  )
    missing.push('INTEGRATION_ZOHO_REGION_FORMAT');
  const definition = providerConfig[provider];
  return {
    ...definition,
    ready: missing.length === 0,
    missing,
  };
}

export function configurationError(error: unknown) {
  return error instanceof AccountProviderFailure
    ? error.code
    : 'PROVIDER_REQUEST_FAILED';
}
