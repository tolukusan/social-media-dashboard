import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import {
  IntegrationFailure,
  type SourceConnection,
} from './integration-contract.js';
import { decryptSecret, encryptSecret } from './oauth-crypto.js';

type ProviderFamily = 'META' | 'LINKEDIN' | 'ZOHO' | 'GOOGLE';
type OAuthProvider =
  | 'FACEBOOK_ADS'
  | 'INSTAGRAM_ADS'
  | 'LINKEDIN_ADS'
  | 'ZOHO_CAMPAIGNS'
  | 'FACEBOOK_ORGANIC'
  | 'INSTAGRAM_ORGANIC'
  | 'LINKEDIN_ORGANIC'
  | 'YOUTUBE_ANALYTICS';
type TokenBundle = {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
};
type OAuthConfig = {
  family: ProviderFamily;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  pkce: boolean;
  region: string;
};
type TokenResponse = Record<string, unknown>;

const stateLifetimeMs = 10 * 60_000;
const refreshLeadMs = 5 * 60_000;
const providerFamilies: Record<OAuthProvider, ProviderFamily> = {
  FACEBOOK_ADS: 'META',
  INSTAGRAM_ADS: 'META',
  LINKEDIN_ADS: 'LINKEDIN',
  ZOHO_CAMPAIGNS: 'ZOHO',
  FACEBOOK_ORGANIC: 'META',
  INSTAGRAM_ORGANIC: 'META',
  LINKEDIN_ORGANIC: 'LINKEDIN',
  YOUTUBE_ANALYTICS: 'GOOGLE',
};
const scopeByProvider: Record<OAuthProvider, string[]> = {
  FACEBOOK_ADS: ['ads_read'],
  INSTAGRAM_ADS: ['ads_read'],
  LINKEDIN_ADS: ['r_ads_reporting'],
  ZOHO_CAMPAIGNS: ['ZohoCampaigns.campaign.READ'],
  FACEBOOK_ORGANIC: [
    'pages_show_list',
    'pages_read_engagement',
    'read_insights',
  ],
  INSTAGRAM_ORGANIC: [
    'instagram_basic',
    'instagram_manage_insights',
    'pages_show_list',
    'pages_read_engagement',
  ],
  LINKEDIN_ORGANIC: ['r_organization_social'],
  YOUTUBE_ANALYTICS: [
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.readonly',
  ],
};
const zohoAccountsHosts: Record<string, string> = {
  US: 'accounts.zoho.com',
  EU: 'accounts.zoho.eu',
  IN: 'accounts.zoho.in',
  AU: 'accounts.zoho.com.au',
  JP: 'accounts.zoho.jp',
  CN: 'accounts.zoho.com.cn',
};

function isProvider(value: string): value is OAuthProvider {
  return Object.hasOwn(providerFamilies, value);
}
function numberField(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}
function textField(value: unknown, limit = 8192) {
  return typeof value === 'string' && value.length > 0 && value.length <= limit
    ? value
    : undefined;
}

class OAuthRefreshGrantRejected extends Error {}

function grantedScopes(payload: TokenResponse, requestedScopes: string[]) {
  const allowed = new Set(requestedScopes);
  const scopeWasReturned = Object.hasOwn(payload, 'scope');
  const raw = textField(payload.scope, 2000);
  if (scopeWasReturned && !raw)
    throw new Error('provider returned an empty or unsupported scope list');
  const granted = raw ? new Set(raw.split(/[\s,]+/).filter(Boolean)) : allowed;
  if (
    [...granted].some((scope) => !allowed.has(scope)) ||
    [...allowed].some((scope) => !granted.has(scope))
  )
    throw new Error('provider scopes do not match the requested permissions');
  return [...granted].sort();
}
function safeAppOrigin() {
  const raw = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  try {
    const url = new URL(raw);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.origin !== raw.replace(/\/$/, '') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new ServiceUnavailableException({
      code: 'OAUTH_REDIRECT_ORIGIN_INVALID',
      message: 'OAuth redirect origins are not configured safely.',
    });
  }
}

@Injectable()
export class OAuthCredentialService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private callbackOrigin() {
    const raw =
      process.env.INTEGRATION_OAUTH_API_ORIGIN?.trim() ||
      (process.env.NODE_ENV === 'production'
        ? ''
        : `http://localhost:${process.env.API_PORT ?? 4000}`);
    if (!raw)
      throw new ServiceUnavailableException({
        code: 'OAUTH_CALLBACK_ORIGIN_NOT_CONFIGURED',
        message: 'OAuth callback origin is not configured on this server.',
      });
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new ServiceUnavailableException({
        code: 'OAUTH_CALLBACK_ORIGIN_INVALID',
        message: 'OAuth callback origin is not configured safely.',
      });
    }
    const exactOrigin = url.origin === raw.replace(/\/$/, '');
    const allowed = (
      process.env.INTEGRATION_OAUTH_ALLOWED_CALLBACK_ORIGINS ?? ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (
      !exactOrigin ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') ||
      !allowed.includes(url.origin)
    )
      throw new ServiceUnavailableException({
        code: 'OAUTH_CALLBACK_ORIGIN_NOT_ALLOWED',
        message: 'OAuth callback origin is not on the server allowlist.',
      });
    return url.origin;
  }

  private callbackUrl(family: ProviderFamily) {
    return `${this.callbackOrigin()}/api/v1/integrations/oauth/${family.toLowerCase()}/callback`;
  }

  private config(provider: OAuthProvider, region: string): OAuthConfig {
    const family = providerFamilies[provider];
    const prefix = `INTEGRATION_${family}_OAUTH`;
    const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim();
    const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim();
    if (!clientId || !clientSecret)
      throw new ServiceUnavailableException({
        code: 'OAUTH_PROVIDER_NOT_CONFIGURED',
        message: 'OAuth is not configured for this provider on the server.',
      });
    const scopes = scopeByProvider[provider];
    if (family === 'META') {
      const version = process.env.INTEGRATION_META_API_VERSION;
      if (!version || !/^v\d+\.\d+$/.test(version))
        throw new ServiceUnavailableException({
          code: 'OAUTH_PROVIDER_NOT_CONFIGURED',
          message: 'OAuth is not configured for this provider on the server.',
        });
      return {
        family,
        clientId,
        clientSecret,
        scopes,
        authorizationUrl: `https://www.facebook.com/${version}/dialog/oauth`,
        tokenUrl: `https://graph.facebook.com/${version}/oauth/access_token`,
        pkce: false,
        region,
      };
    }
    if (family === 'LINKEDIN')
      return {
        family,
        clientId,
        clientSecret,
        scopes,
        authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        pkce: false,
        region,
      };
    if (family === 'GOOGLE')
      return {
        family,
        clientId,
        clientSecret,
        scopes,
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        pkce: true,
        region,
      };
    const accountsHost = zohoAccountsHosts[region];
    if (!accountsHost)
      throw new ServiceUnavailableException({
        code: 'OAUTH_PROVIDER_NOT_CONFIGURED',
        message: 'OAuth is not configured for this provider on the server.',
      });
    return {
      family,
      clientId,
      clientSecret,
      scopes,
      authorizationUrl: `https://${accountsHost}/oauth/v2/auth`,
      tokenUrl: `https://${accountsHost}/oauth/v2/token`,
      pkce: false,
      region,
    };
  }

  async start(connectionId: string, actorId: string) {
    const connection = await this.prisma.integrationConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        provider: true,
        region: true,
        configuredByUserId: true,
        active: true,
      },
    });
    if (!connection)
      throw new NotFoundException({
        code: 'INTEGRATION_NOT_FOUND',
        message: 'Integration connection not found.',
      });
    if (connection.configuredByUserId !== actorId)
      throw new ForbiddenException({
        code: 'INTEGRATION_OWNER_REQUIRED',
        message:
          'Only the configuring Administrator can authorize this account.',
      });
    if (!isProvider(connection.provider))
      throw new ServiceUnavailableException({
        code: 'OAUTH_PROVIDER_UNSUPPORTED',
        message: 'OAuth is not available for this provider product.',
      });
    const config = this.config(connection.provider, connection.region);
    const callbackUrl = this.callbackUrl(config.family);
    // Fail before redirecting if the server cannot encrypt the eventual token.
    encryptSecret('oauth-configuration-check');
    const state = randomBytes(32).toString('base64url');
    const stateHash = createHash('sha256').update(state).digest('hex');
    let verifier: string | undefined;
    let challenge: string | undefined;
    if (config.pkce) {
      verifier = randomBytes(32).toString('base64url');
      challenge = createHash('sha256').update(verifier).digest('base64url');
    }
    const expiresAt = new Date(Date.now() + stateLifetimeMs);
    await this.prisma.$transaction(async (tx) => {
      await tx.integrationOAuthAttempt.updateMany({
        where: {
          connectionId,
          status: 'PENDING',
        },
        data: { status: 'EXPIRED', consumedAt: new Date() },
      });
      const generation = await tx.integrationConnection.update({
        where: { id: connectionId },
        data: { oauthGeneration: { increment: 1 } },
        select: { oauthGeneration: true },
      });
      await tx.integrationOAuthAttempt.create({
        data: {
          connectionId,
          requestedByUserId: actorId,
          provider: connection.provider,
          oauthGeneration: generation.oauthGeneration,
          stateHash,
          encryptedPkceVerifier: verifier ? encryptSecret(verifier) : null,
          expiresAt,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'IntegrationConnection',
          entityId: connectionId,
          action: 'INTEGRATION_OAUTH_STARTED',
          metadata: { provider: connection.provider },
        },
      });
    });
    const authorizationUrl = new URL(config.authorizationUrl);
    authorizationUrl.searchParams.set('client_id', config.clientId);
    authorizationUrl.searchParams.set('redirect_uri', callbackUrl);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set(
      'scope',
      config.scopes.join(config.family === 'META' ? ',' : ' '),
    );
    authorizationUrl.searchParams.set('state', state);
    if (challenge) {
      authorizationUrl.searchParams.set('code_challenge', challenge);
      authorizationUrl.searchParams.set('code_challenge_method', 'S256');
    }
    if (config.family === 'GOOGLE') {
      authorizationUrl.searchParams.set('access_type', 'offline');
      authorizationUrl.searchParams.set('prompt', 'consent');
    }
    if (config.family === 'ZOHO')
      authorizationUrl.searchParams.set('access_type', 'offline');
    return { authorizationUrl: authorizationUrl.toString(), expiresAt };
  }

  private async requestToken(
    config: OAuthConfig,
    fields: Record<string, string>,
  ): Promise<TokenResponse> {
    try {
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(10_000),
        redirect: 'error',
      });
      const declaredLength = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > 64 * 1024) {
        await response.body?.cancel();
        throw new Error('provider response too large');
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error('provider response body missing');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 64 * 1024) {
          await reader.cancel();
          throw new Error('provider response too large');
        }
        chunks.push(value);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      let payload: TokenResponse;
      try {
        const parsed: unknown = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('invalid payload');
        payload = parsed as TokenResponse;
      } catch {
        const parameters = new URLSearchParams(body);
        payload = Object.fromEntries(parameters.entries());
      }
      if (
        fields.grant_type === 'refresh_token' &&
        (payload.error === 'invalid_grant' ||
          (config.family === 'ZOHO' && payload.error === 'invalid_code'))
      )
        throw new OAuthRefreshGrantRejected();
      if (!response.ok || payload.error)
        throw new Error('provider token request failed');
      return payload;
    } catch (error) {
      if (error instanceof OAuthRefreshGrantRejected) throw error;
      throw new ServiceUnavailableException({
        code: 'OAUTH_PROVIDER_UNAVAILABLE',
        message:
          'The provider authorization could not be completed. Retry connection.',
      });
    }
  }

  private tokenBundle(payload: TokenResponse, fallback?: TokenBundle) {
    const accessToken = textField(payload.access_token);
    if (!accessToken)
      throw new ServiceUnavailableException({
        code: 'OAUTH_TOKEN_RESPONSE_INVALID',
        message: 'The provider returned an unsupported authorization response.',
      });
    const returnedRefreshToken = textField(payload.refresh_token);
    const refreshToken = returnedRefreshToken ?? fallback?.refreshToken;
    const tokenType = textField(payload.token_type, 80) ?? fallback?.tokenType;
    const expiresIn = numberField(payload.expires_in);
    const refreshExpiresIn = numberField(payload.refresh_token_expires_in);
    const rawScope = textField(payload.scope, 2000);
    return {
      bundle: {
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
        ...(tokenType ? { tokenType } : {}),
      } satisfies TokenBundle,
      tokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
      refreshTokenExpiresAt: refreshExpiresIn
        ? new Date(Date.now() + refreshExpiresIn * 1000)
        : undefined,
      returnedRefreshToken: !!returnedRefreshToken,
      scope: rawScope,
    };
  }

  private async exchangeCode(
    config: OAuthConfig,
    code: string,
    callbackUrl: string,
    verifier?: string,
  ) {
    return this.requestToken(config, {
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: callbackUrl,
      ...(verifier ? { code_verifier: verifier } : {}),
    });
  }

  async callback(
    familyPath: string,
    state: string | undefined,
    code: string | undefined,
    providerError: string | undefined,
  ) {
    const family = familyPath.toUpperCase();
    if (!['META', 'LINKEDIN', 'ZOHO', 'GOOGLE'].includes(family))
      return 'error';
    if (
      typeof state !== 'string' ||
      state.length > 128 ||
      !/^[A-Za-z0-9_-]+$/.test(state) ||
      (providerError !== undefined && typeof providerError !== 'string') ||
      (code !== undefined && typeof code !== 'string')
    )
      return 'error';
    const stateHash = createHash('sha256').update(state).digest('hex');
    const attempt = await this.prisma.integrationOAuthAttempt.findUnique({
      where: { stateHash },
      include: {
        connection: {
          select: {
            id: true,
            provider: true,
            region: true,
            configuredByUserId: true,
            configuredByUser: {
              select: {
                active: true,
                role: { select: { code: true, active: true } },
              },
            },
          },
        },
      },
    });
    if (
      !attempt ||
      attempt.connection.configuredByUserId !== attempt.requestedByUserId ||
      !attempt.connection.configuredByUser.active ||
      !attempt.connection.configuredByUser.role.active ||
      attempt.connection.configuredByUser.role.code !== 'ADMIN' ||
      !isProvider(attempt.provider) ||
      providerFamilies[attempt.provider] !== family
    )
      return 'error';
    const actorId = attempt.requestedByUserId;
    const now = new Date();
    if (attempt.status !== 'PENDING' || attempt.consumedAt) return 'error';
    const consumed = await this.prisma.integrationOAuthAttempt.updateMany({
      where: {
        id: attempt.id,
        status: 'PENDING',
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        status: providerError ? 'DENIED' : 'FAILED',
        consumedAt: now,
      },
    });
    if (!consumed.count) {
      await this.prisma.integrationOAuthAttempt.updateMany({
        where: { id: attempt.id, status: 'PENDING', expiresAt: { lte: now } },
        data: { status: 'EXPIRED', consumedAt: now },
      });
      return 'error';
    }
    if (providerError) {
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'IntegrationConnection',
          entityId: attempt.connectionId,
          action: 'INTEGRATION_OAUTH_DENIED',
          metadata: { provider: attempt.provider },
        },
      });
      return 'denied';
    }
    if (!code || code.length > 4096) return 'error';
    try {
      const config = this.config(attempt.provider, attempt.connection.region);
      const callbackUrl = this.callbackUrl(config.family);
      const verifier = attempt.encryptedPkceVerifier
        ? decryptSecret(attempt.encryptedPkceVerifier)
        : undefined;
      const payload = await this.exchangeCode(
        config,
        code,
        callbackUrl,
        verifier,
      );
      const normalizedScopes = grantedScopes(payload, config.scopes);
      const previous = await this.prisma.integrationOAuthCredential.findUnique({
        where: { connectionId: attempt.connectionId },
      });
      const previousBundle = previous
        ? (JSON.parse(
            decryptSecret(previous.encryptedTokenBundle),
          ) as TokenBundle)
        : undefined;
      const token = this.tokenBundle(payload, previousBundle);
      const scopes = normalizedScopes.join(' ').slice(0, 2000);
      await this.prisma.$transaction(async (tx) => {
        const currentConnection = await tx.integrationConnection.updateMany({
          where: {
            id: attempt.connectionId,
            oauthGeneration: attempt.oauthGeneration,
          },
          data: { credentialMode: 'OAUTH', active: true },
        });
        if (!currentConnection.count)
          throw new Error('oauth attempt was superseded');
        await tx.integrationOAuthCredential.upsert({
          where: { connectionId: attempt.connectionId },
          create: {
            connectionId: attempt.connectionId,
            encryptedTokenBundle: encryptSecret(JSON.stringify(token.bundle)),
            tokenExpiresAt: token.tokenExpiresAt,
            refreshTokenExpiresAt: token.returnedRefreshToken
              ? (token.refreshTokenExpiresAt ?? null)
              : (previous?.refreshTokenExpiresAt ?? null),
            grantedScopes: scopes,
            status: 'CONNECTED',
            connectedAt: now,
            lastErrorCode: null,
          },
          update: {
            encryptedTokenBundle: encryptSecret(JSON.stringify(token.bundle)),
            tokenExpiresAt: token.tokenExpiresAt,
            refreshTokenExpiresAt: token.returnedRefreshToken
              ? (token.refreshTokenExpiresAt ?? null)
              : (previous?.refreshTokenExpiresAt ?? null),
            grantedScopes: scopes,
            status: 'CONNECTED',
            connectedAt: now,
            lastErrorCode: null,
          },
        });
        await tx.integrationOAuthAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUCCEEDED' },
        });
        await tx.auditLog.create({
          data: {
            actorUserId: actorId,
            entityType: 'IntegrationConnection',
            entityId: attempt.connectionId,
            action: 'INTEGRATION_OAUTH_CONNECTED',
            metadata: { provider: attempt.provider, grantedScopes: scopes },
          },
        });
      });
      return 'connected';
    } catch {
      await this.prisma.integrationOAuthAttempt.updateMany({
        where: { id: attempt.id },
        data: { status: 'FAILED' },
      });
      await this.prisma.auditLog.create({
        data: {
          actorUserId: actorId,
          entityType: 'IntegrationConnection',
          entityId: attempt.connectionId,
          action: 'INTEGRATION_OAUTH_FAILED',
          metadata: { provider: attempt.provider },
        },
      });
      return 'error';
    }
  }

  async accessToken(connection: SourceConnection & { id: string }) {
    const credential = await this.prisma.integrationOAuthCredential.findUnique({
      where: { connectionId: connection.id },
    });
    if (!credential) return null;
    if (credential.status !== 'CONNECTED')
      throw new IntegrationFailure(
        'REAUTHORIZATION_REQUIRED',
        'Reconnect this provider account before syncing.',
      );
    let bundle: TokenBundle;
    try {
      bundle = JSON.parse(
        decryptSecret(credential.encryptedTokenBundle),
      ) as TokenBundle;
    } catch {
      await this.markReauthorizationRequired(
        connection.id,
        'CREDENTIAL_UNREADABLE',
      );
      throw new IntegrationFailure(
        'REAUTHORIZATION_REQUIRED',
        'Reconnect this provider account before syncing.',
      );
    }
    if (
      !credential.tokenExpiresAt ||
      credential.tokenExpiresAt.getTime() > Date.now() + refreshLeadMs
    )
      return bundle.accessToken;
    const provider = connection.provider as OAuthProvider;
    const family = providerFamilies[provider];
    const config = this.config(provider, connection.region);
    if (
      (family !== 'META' && !bundle.refreshToken) ||
      (credential.refreshTokenExpiresAt &&
        credential.refreshTokenExpiresAt <= new Date())
    ) {
      await this.markReauthorizationRequired(connection.id, 'TOKEN_EXPIRED');
      throw new IntegrationFailure(
        'REAUTHORIZATION_REQUIRED',
        'Reconnect this provider account before syncing.',
      );
    }
    try {
      let fields: Record<string, string>;
      if (family === 'META') {
        fields = {
          grant_type: 'fb_exchange_token',
          client_id: config.clientId,
          client_secret: config.clientSecret,
          fb_exchange_token: bundle.accessToken,
        };
      } else {
        fields = {
          grant_type: 'refresh_token',
          refresh_token: bundle.refreshToken!,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        };
      }
      const payload = await this.requestToken(config, fields);
      const normalizedScopes = grantedScopes(payload, config.scopes);
      const refreshed = this.tokenBundle(payload, bundle);
      await this.prisma.integrationOAuthCredential.update({
        where: { connectionId: connection.id },
        data: {
          encryptedTokenBundle: encryptSecret(JSON.stringify(refreshed.bundle)),
          tokenExpiresAt: refreshed.tokenExpiresAt,
          refreshTokenExpiresAt: refreshed.returnedRefreshToken
            ? (refreshed.refreshTokenExpiresAt ?? null)
            : credential.refreshTokenExpiresAt,
          grantedScopes: normalizedScopes.join(' ').slice(0, 2000),
          status: 'CONNECTED',
          lastRefreshedAt: new Date(),
          lastErrorCode: null,
        },
      });
      return refreshed.bundle.accessToken;
    } catch (error) {
      if (error instanceof OAuthRefreshGrantRejected) {
        await this.markReauthorizationRequired(
          connection.id,
          'TOKEN_REFRESH_REJECTED',
        );
        throw new IntegrationFailure(
          'REAUTHORIZATION_REQUIRED',
          'Reconnect this provider account before syncing.',
        );
      }
      throw new IntegrationFailure(
        'PROVIDER_UNAVAILABLE',
        'The provider could not refresh the connection. Retry later.',
      );
    }
  }

  async markReauthorizationRequired(connectionId: string, code: string) {
    await this.prisma.integrationOAuthCredential.updateMany({
      where: { connectionId },
      data: { status: 'REAUTH_REQUIRED', lastErrorCode: code.slice(0, 60) },
    });
  }

  async redirectDestination(result: 'connected' | 'denied' | 'error') {
    const target = new URL('/integrations', `${safeAppOrigin()}/`);
    target.searchParams.set('oauth', result);
    return target.toString();
  }
}
