import { afterEach, describe, expect, it, vi } from 'vitest';
import { encryptCredentials } from './account-crypto.js';
import { ConnectedAccountsService } from './connected-accounts.service.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('connected account response boundary', () => {
  it('returns account labels and sync status without credentials or internal profile expiry', async () => {
    const service = new ConnectedAccountsService(
      {
        connectedAccount: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'account-id',
              provider: 'INSTAGRAM',
              kind: 'SOCIAL',
              externalAccountId: 'instagram-account-id',
              displayName: 'Example Creator',
              handle: 'example',
              profileUrl: 'https://www.instagram.com/example/',
              profileMetadataExpiresAt: null,
              credentialCiphertext: 'server-only-ciphertext',
              tokenExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
              connectedByUserId: 'internal-user-id',
              active: true,
              connectedAt: new Date('2026-10-01T00:00:00.000Z'),
              lastSyncedAt: null,
              lastSyncErrorCode: null,
              connectedByUser: {
                id: 'internal-user-id',
                name: 'Workspace admin',
              },
            },
          ]),
        },
      } as never,
      {} as never,
    );

    const accounts = await service.list();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: 'account-id',
      provider: 'INSTAGRAM',
      displayName: 'Example Creator',
      connectedByUser: { name: 'Workspace admin' },
    });
    expect(JSON.stringify(accounts)).not.toContain('server-only-ciphertext');
    expect(accounts[0]).not.toHaveProperty('tokenExpiresAt');
    expect(accounts[0]).not.toHaveProperty('profileMetadataExpiresAt');
    expect(accounts[0]).not.toHaveProperty('connectedByUserId');
  });
});

describe('Zoho email report rate summaries', () => {
  it('weights provider-reported rates by delivered messages and preserves campaign rates', async () => {
    const service = new ConnectedAccountsService(
      {
        connectedAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'zoho-account',
            provider: 'ZOHO_CAMPAIGNS',
            kind: 'EMAIL',
            externalAccountId: 'zoho-us',
            displayName: 'Zoho US',
            handle: null,
            profileUrl: null,
            profileMetadataExpiresAt: null,
            active: true,
            connectedAt: new Date('2026-10-01T00:00:00.000Z'),
            lastSyncedAt: new Date('2026-10-17T00:00:00.000Z'),
            lastSyncErrorCode: null,
          }),
        },
        emailCampaignSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              externalCampaignId: 'campaign-1',
              campaignName: 'Campaign one',
              sentAt: new Date('2026-10-15T00:00:00.000Z'),
              observedAt: new Date('2026-10-17T00:00:00.000Z'),
              metricValues: {
                SENT: 110,
                DELIVERED: 100,
                OPEN_RATE: 10,
                UNIQUE_CLICK_RATE: 5,
              },
            },
            {
              externalCampaignId: 'campaign-2',
              campaignName: 'Campaign two',
              sentAt: new Date('2026-10-16T00:00:00.000Z'),
              observedAt: new Date('2026-10-17T00:00:00.000Z'),
              metricValues: {
                SENT: 330,
                DELIVERED: 300,
                OPEN_RATE: 20,
                UNIQUE_CLICK_RATE: 8,
              },
            },
          ]),
        },
      } as never,
      {} as never,
    );

    const report = await service.emailReport(
      'zoho-account',
      '2026-10-01',
      '2026-10-17',
    );

    expect(report.totals).toMatchObject({
      SENT: 440,
      DELIVERED: 400,
      OPEN_RATE: 17.5,
      UNIQUE_CLICK_RATE: 7.25,
    });
    expect(report.campaigns.map((campaign) => campaign.metricValues)).toEqual([
      { SENT: 110, DELIVERED: 100, OPEN_RATE: 10, UNIQUE_CLICK_RATE: 5 },
      { SENT: 330, DELIVERED: 300, OPEN_RATE: 20, UNIQUE_CLICK_RATE: 8 },
    ]);
    expect(report.caveats.join(' ')).toContain(
      'up to 400 recent sent campaigns',
    );
  });

  it('keeps missing campaign metrics unavailable while preserving an explicit zero', async () => {
    const service = new ConnectedAccountsService(
      {
        connectedAccount: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'zoho-account',
            provider: 'ZOHO_CAMPAIGNS',
            kind: 'EMAIL',
            externalAccountId: 'zoho-us',
            displayName: 'Zoho US',
            handle: null,
            profileUrl: null,
            profileMetadataExpiresAt: null,
            active: true,
            connectedAt: new Date('2026-10-01T00:00:00.000Z'),
            lastSyncedAt: new Date('2026-10-17T00:00:00.000Z'),
            lastSyncErrorCode: null,
          }),
        },
        emailCampaignSnapshot: {
          findMany: vi.fn().mockResolvedValue([
            {
              externalCampaignId: 'campaign-1',
              campaignName: 'Campaign one',
              sentAt: new Date('2026-10-15T00:00:00.000Z'),
              observedAt: new Date('2026-10-17T00:00:00.000Z'),
              metricValues: { DELIVERED: 100, OPEN_RATE: 0 },
            },
          ]),
        },
      } as never,
      {} as never,
    );

    const report = await service.emailReport(
      'zoho-account',
      '2026-10-01',
      '2026-10-17',
    );

    expect(report.totals).toMatchObject({
      SENT: null,
      DELIVERED: 100,
      OPENS: null,
      OPEN_RATE: 0,
      UNIQUE_CLICK_RATE: null,
    });
    expect(report.caveats.join(' ')).toContain(
      'up to 400 recent sent campaigns',
    );
  });
});

describe('connected account disconnect', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');

  function createService(
    provider: 'YOUTUBE' | 'ZOHO_CAMPAIGNS' | 'INSTAGRAM',
    credentials: { accessToken: string; refreshToken?: string },
    relatedAccounts: Array<{ credentialCiphertext: string }> = [],
    credentialCiphertext?: string,
  ) {
    vi.stubEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY', encryptionKey);
    const account = {
      id: 'connected-account-id',
      provider,
      active: true,
      credentialCiphertext:
        credentialCiphertext ?? encryptCredentials(credentials),
    };
    const auditCreate = vi.fn();
    const deleteAccount = vi.fn();
    const prisma = {
      connectedAccount: {
        findUnique: vi.fn().mockResolvedValue(account),
        findMany: vi.fn().mockResolvedValue(relatedAccounts),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditLog: { create: auditCreate },
          connectedAccount: { delete: deleteAccount },
        }),
      ),
    };
    const providerClient = {
      revokeCredentials: vi.fn().mockResolvedValue('revoked'),
    };
    const service = new ConnectedAccountsService(
      prisma as never,
      providerClient as never,
    );
    return { service, prisma, providerClient, auditCreate, deleteAccount };
  }

  it('revokes provider access when disconnecting the last connected account using a grant', async () => {
    const { service, providerClient, auditCreate, deleteAccount } =
      createService('YOUTUBE', {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });

    const result = await service.disconnect('connected-account-id', 'actor-id');

    expect(providerClient.revokeCredentials).toHaveBeenCalledWith('YOUTUBE', {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(result).toMatchObject({
      disconnected: true,
      providerDataDeleted: true,
      providerAccessRevocation: 'revoked',
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: {
            provider: 'YOUTUBE',
            providerAccessRevocation: 'revoked',
          },
        }),
      }),
    );
    expect(deleteAccount).toHaveBeenCalledWith({
      where: { id: 'connected-account-id' },
    });
  });

  it('keeps a shared provider grant active while another account still uses it', async () => {
    vi.stubEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY', encryptionKey);
    const { service, providerClient } = createService(
      'YOUTUBE',
      { accessToken: 'access-token-1', refreshToken: 'shared-refresh-token' },
      [
        {
          credentialCiphertext: encryptCredentials({
            accessToken: 'access-token-2',
            refreshToken: 'shared-refresh-token',
          }),
        },
      ],
    );

    const result = await service.disconnect('connected-account-id', 'actor-id');

    expect(providerClient.revokeCredentials).not.toHaveBeenCalled();
    expect(result.providerAccessRevocation).toBe('still_in_use');
  });

  it('does not revoke when a sibling credential cannot be checked', async () => {
    const { service, providerClient } = createService(
      'ZOHO_CAMPAIGNS',
      {
        accessToken: 'zoho-access-token',
        refreshToken: 'zoho-refresh-token',
      },
      [{ credentialCiphertext: 'unreadable-ciphertext' }],
    );

    const result = await service.disconnect('connected-account-id', 'actor-id');

    expect(providerClient.revokeCredentials).not.toHaveBeenCalled();
    expect(result.providerAccessRevocation).toBe('failed');
  });

  it('reports providers whose grants cannot be revoked programmatically', async () => {
    const { service, providerClient } = createService('INSTAGRAM', {
      accessToken: 'page-token',
    });

    const result = await service.disconnect('connected-account-id', 'actor-id');

    expect(providerClient.revokeCredentials).not.toHaveBeenCalled();
    expect(result.providerAccessRevocation).toBe('not_supported');
  });

  it('deletes local data when the account credential cannot be decrypted', async () => {
    const { service, providerClient, deleteAccount } = createService(
      'YOUTUBE',
      { accessToken: 'unused-token' },
      [],
      'corrupt-ciphertext',
    );

    const result = await service.disconnect('connected-account-id', 'actor-id');

    expect(providerClient.revokeCredentials).not.toHaveBeenCalled();
    expect(deleteAccount).toHaveBeenCalledOnce();
    expect(result.providerAccessRevocation).toBe('failed');
  });
});
