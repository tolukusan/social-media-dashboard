import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IntegrationFailure } from './integration-contract.js';
import { OAuthCredentialService } from './oauth-credential.service.js';
import { encryptSecret } from './oauth-crypto.js';

function attempt(roleCode = 'ADMIN') {
  const ownerId = 'configuring-admin';
  return {
    id: 'attempt-id',
    connectionId: 'connection-id',
    requestedByUserId: ownerId,
    provider: 'ZOHO_CAMPAIGNS',
    oauthGeneration: 1,
    status: 'PENDING',
    consumedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    connection: {
      id: 'connection-id',
      provider: 'ZOHO_CAMPAIGNS',
      region: 'US',
      configuredByUserId: ownerId,
      configuredByUser: {
        active: true,
        role: { code: roleCode, active: true },
      },
    },
  };
}

function serviceFor(oauthAttempt: ReturnType<typeof attempt>) {
  const prisma = {
    integrationOAuthAttempt: {
      findUnique: vi.fn().mockResolvedValue(oauthAttempt),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  return {
    service: new OAuthCredentialService(prisma as never),
    prisma,
  };
}

function startServiceFor(
  provider: 'YOUTUBE_ANALYTICS' | 'ZOHO_CAMPAIGNS',
  region = 'US',
) {
  const tx = {
    integrationOAuthAttempt: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    integrationConnection: {
      update: vi.fn().mockResolvedValue({ oauthGeneration: 1 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    integrationConnection: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'connection-id',
        provider,
        region,
        configuredByUserId: 'configuring-admin',
        active: true,
      }),
    },
    $transaction: vi.fn(async (work: (client: typeof tx) => unknown) =>
      work(tx),
    ),
  };
  return {
    service: new OAuthCredentialService(prisma as never),
    prisma,
    tx,
  };
}

function configureOAuthEnv(family: 'GOOGLE' | 'ZOHO') {
  vi.stubEnv(
    'INTEGRATION_OAUTH_ENCRYPTION_KEY',
    Buffer.alloc(32, 7).toString('base64'),
  );
  vi.stubEnv('INTEGRATION_OAUTH_API_ORIGIN', 'https://callback.example.test');
  vi.stubEnv(
    'INTEGRATION_OAUTH_ALLOWED_CALLBACK_ORIGINS',
    'https://callback.example.test',
  );
  vi.stubEnv(
    `INTEGRATION_${family}_OAUTH_CLIENT_ID`,
    `fixture-${family.toLowerCase()}-id`,
  );
  vi.stubEnv(
    `INTEGRATION_${family}_OAUTH_CLIENT_SECRET`,
    `fixture-${family.toLowerCase()}-secret`,
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('OAuthCredentialService provider authorization', () => {
  it('requests only YouTube read scopes and uses Google S256 PKCE', async () => {
    configureOAuthEnv('GOOGLE');
    const { service, tx } = startServiceFor('YOUTUBE_ANALYTICS');

    const result = await service.start('connection-id', 'configuring-admin');
    const url = new URL(result.authorizationUrl);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://callback.example.test/api/v1/integrations/oauth/google/callback',
    );
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/youtube.readonly',
    ]);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tx.integrationOAuthAttempt.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestedByUserId: 'configuring-admin',
        provider: 'YOUTUBE_ANALYTICS',
        encryptedPkceVerifier: expect.any(String),
        stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
  });

  it('requests only Zoho Campaigns read scope and uses the connection region', async () => {
    configureOAuthEnv('ZOHO');
    const { service } = startServiceFor('ZOHO_CAMPAIGNS', 'EU');

    const result = await service.start('connection-id', 'configuring-admin');
    const url = new URL(result.authorizationUrl);

    expect(url.origin).toBe('https://accounts.zoho.eu');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://callback.example.test/api/v1/integrations/oauth/zoho/callback',
    );
    expect(url.searchParams.get('scope')).toBe('ZohoCampaigns.campaign.READ');
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe('OAuthCredentialService provider callback', () => {
  it('uses the pending state owner for an unauthenticated provider denial callback', async () => {
    const fixture = attempt();
    const { service, prisma } = serviceFor(fixture);
    const state = randomBytes(32).toString('base64url');

    await expect(
      service.callback('zoho', state, undefined, 'access_denied'),
    ).resolves.toBe('denied');
    expect(prisma.integrationOAuthAttempt.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: fixture.id }),
        data: expect.objectContaining({ status: 'DENIED' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: fixture.requestedByUserId,
        action: 'INTEGRATION_OAUTH_DENIED',
      }),
    });
  });

  it('rejects callback state whose original connection owner is no longer an Administrator', async () => {
    const { service, prisma } = serviceFor(attempt('MARKETING_OFFICER'));
    const state = randomBytes(32).toString('base64url');

    await expect(
      service.callback('zoho', state, undefined, 'access_denied'),
    ).resolves.toBe('error');
    expect(prisma.integrationOAuthAttempt.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a callback after the Administrator role is disabled', async () => {
    const fixture = attempt();
    fixture.connection.configuredByUser.role.active = false;
    const { service, prisma } = serviceFor(fixture);
    const state = randomBytes(32).toString('base64url');

    await expect(
      service.callback('zoho', state, undefined, 'access_denied'),
    ).resolves.toBe('error');
    expect(prisma.integrationOAuthAttempt.updateMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('requires a loopback callback origin to be explicitly allowlisted', async () => {
    configureOAuthEnv('ZOHO');
    vi.stubEnv('INTEGRATION_OAUTH_API_ORIGIN', 'http://localhost:4321');
    vi.stubEnv('INTEGRATION_OAUTH_ALLOWED_CALLBACK_ORIGINS', '');
    const { service } = startServiceFor('ZOHO_CAMPAIGNS');

    await expect(
      service.start('connection-id', 'configuring-admin'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'OAUTH_CALLBACK_ORIGIN_NOT_ALLOWED',
      }),
    });
  });
});

describe('OAuthCredentialService refresh recovery', () => {
  function refreshFixture(
    response: Response,
    provider: 'YOUTUBE_ANALYTICS' | 'ZOHO_CAMPAIGNS' = 'YOUTUBE_ANALYTICS',
  ) {
    configureOAuthEnv(provider === 'YOUTUBE_ANALYTICS' ? 'GOOGLE' : 'ZOHO');
    const scopes =
      provider === 'YOUTUBE_ANALYTICS'
        ? 'https://www.googleapis.com/auth/yt-analytics.readonly https://www.googleapis.com/auth/youtube.readonly'
        : 'ZohoCampaigns.campaign.READ';
    const credential = {
      status: 'CONNECTED',
      encryptedTokenBundle: encryptSecret(
        JSON.stringify({
          accessToken: 'fixture-access-token',
          refreshToken: 'fixture-refresh-token',
        }),
      ),
      tokenExpiresAt: new Date(Date.now() - 60_000),
      refreshTokenExpiresAt: null,
      grantedScopes: scopes,
    };
    const prisma = {
      integrationOAuthCredential: {
        findUnique: vi.fn().mockResolvedValue(credential),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    return {
      service: new OAuthCredentialService(prisma as never),
      prisma,
      connection: {
        id: 'connection-id',
        provider,
        region: 'US',
      } as never,
    };
  }

  it('keeps a connected credential when the refresh endpoint is temporarily unavailable', async () => {
    const { service, prisma, connection } = refreshFixture(
      new Response(JSON.stringify({ error: 'temporarily_unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.accessToken(connection)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    } satisfies Partial<IntegrationFailure>);
    expect(prisma.integrationOAuthCredential.updateMany).not.toHaveBeenCalled();
    expect(prisma.integrationOAuthCredential.update).not.toHaveBeenCalled();
  });

  it('requires reconnection only when the provider rejects the refresh grant', async () => {
    const { service, prisma, connection } = refreshFixture(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(service.accessToken(connection)).rejects.toMatchObject({
      code: 'REAUTHORIZATION_REQUIRED',
    } satisfies Partial<IntegrationFailure>);
    expect(prisma.integrationOAuthCredential.updateMany).toHaveBeenCalledWith({
      where: { connectionId: 'connection-id' },
      data: {
        status: 'REAUTH_REQUIRED',
        lastErrorCode: 'TOKEN_REFRESH_REJECTED',
      },
    });
  });

  it('recognizes Zoho invalid_code as a revoked refresh grant', async () => {
    const { service, prisma, connection } = refreshFixture(
      new Response(JSON.stringify({ error: 'invalid_code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
      'ZOHO_CAMPAIGNS',
    );

    await expect(service.accessToken(connection)).rejects.toMatchObject({
      code: 'REAUTHORIZATION_REQUIRED',
    } satisfies Partial<IntegrationFailure>);
    expect(prisma.integrationOAuthCredential.updateMany).toHaveBeenCalledWith({
      where: { connectionId: 'connection-id' },
      data: {
        status: 'REAUTH_REQUIRED',
        lastErrorCode: 'TOKEN_REFRESH_REJECTED',
      },
    });
  });
});
