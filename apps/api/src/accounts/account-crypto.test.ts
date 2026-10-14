import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  decryptCredentials,
  encryptCredentials,
  hashOAuthState,
  newOAuthState,
  providerSetup,
} from './account-crypto.js';

afterEach(() => vi.unstubAllEnvs());

describe('connected account OAuth safeguards', () => {
  it('encrypts OAuth tokens and rejects ciphertext with a different key', () => {
    const key = Buffer.alloc(32, 17).toString('base64');
    vi.stubEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY', key);
    const credentials = {
      accessToken: 'fixture-access-token',
      refreshToken: 'fixture-refresh-token',
      providerData: { organizationUrn: 'urn:li:organization:123' },
    };
    const encrypted = encryptCredentials(credentials);
    expect(encrypted).not.toContain(credentials.accessToken);
    expect(decryptCredentials(encrypted)).toEqual(credentials);

    vi.stubEnv(
      'INTEGRATION_TOKEN_ENCRYPTION_KEY',
      Buffer.alloc(32, 18).toString('base64'),
    );
    expect(() => decryptCredentials(encrypted)).toThrowError(
      expect.objectContaining({ code: 'TOKEN_DECRYPTION_FAILED' }),
    );
  });

  it('creates an unguessable OAuth state and stores only its digest', () => {
    const state = newOAuthState();
    expect(state).toMatch(/^[A-Za-z0-9_-]{40,100}$/);
    expect(hashOAuthState(state)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOAuthState(state)).not.toBe(state);
  });

  it('reports missing server setup without exposing configured values', () => {
    const incomplete = providerSetup('YOUTUBE', {});
    expect(incomplete.ready).toBe(false);
    expect(incomplete.missing).toContain('INTEGRATION_GOOGLE_CLIENT_ID');

    const configured = providerSetup('YOUTUBE', {
      INTEGRATION_OAUTH_REDIRECT_URI:
        'https://api.example.test/api/v1/accounts/oauth/callback',
      INTEGRATION_TOKEN_ENCRYPTION_KEY: 'server-only-key',
      INTEGRATION_GOOGLE_CLIENT_ID: 'server-only-client-id',
      INTEGRATION_GOOGLE_CLIENT_SECRET: 'server-only-client-secret',
    });
    expect(configured.ready).toBe(true);
    expect(JSON.stringify(configured)).not.toContain('server-only');
    expect(configured.scopes).toEqual([
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
    ]);
  });
});
