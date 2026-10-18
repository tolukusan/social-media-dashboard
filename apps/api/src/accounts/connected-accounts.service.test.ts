import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { encryptCredentials } from './account-crypto.js';
import { ConnectedAccountsService } from './connected-accounts.service.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

const accountAnalytics = {} as never;

function newService(prisma: unknown, providerClient: unknown = {}) {
  return new ConnectedAccountsService(
    prisma as never,
    providerClient as never,
    accountAnalytics,
  );
}

describe('connected account response boundary', () => {
  it('returns account labels and sync status without credentials or internal profile expiry', async () => {
    const service = newService({
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
    });

    const accounts = await service.list();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({
      id: 'account-id',
      provider: 'INSTAGRAM',
      displayName: 'Example Creator',
      active: true,
      connectedByUser: { name: 'Workspace admin' },
    });
    expect(JSON.stringify(accounts)).not.toContain('server-only-ciphertext');
    expect(accounts[0]).not.toHaveProperty('tokenExpiresAt');
    expect(accounts[0]).not.toHaveProperty('profileMetadataExpiresAt');
    expect(accounts[0]).not.toHaveProperty('connectedByUserId');
  });
});

describe('Zoho email report definitions', () => {
  const inactiveZohoAccount = {
    id: 'zoho-account',
    provider: 'ZOHO_CAMPAIGNS',
    kind: 'EMAIL',
    externalAccountId: 'zoho-us',
    displayName: 'Zoho US',
    handle: null,
    profileUrl: null,
    profileMetadataExpiresAt: null,
    active: false,
    connectedAt: new Date('2026-10-01T00:00:00.000Z'),
    lastSyncedAt: new Date('2026-10-17T00:00:00.000Z'),
    lastSyncErrorCode: null,
  };

  it('reads retained history after disconnect and aggregates with metric definitions', async () => {
    const codes = [
      ['SENT', 'SUM', null],
      ['DELIVERED', 'SUM', null],
      ['OPEN_RATE', 'WEIGHTED_AVERAGE', 'DELIVERED'],
      ['UNIQUE_CLICK_RATE', 'WEIGHTED_AVERAGE', 'DELIVERED'],
    ] as const;
    const metricValues = (values: Record<string, number>) =>
      Object.entries(values).map(([code, value]) => ({
        value,
        metricDefinitionId: code,
        metricDefinition: {
          code,
          aggregationStrategy:
            codes.find((item) => item[0] === code)?.[1] ?? 'SUM',
          weightingMetricCode:
            codes.find((item) => item[0] === code)?.[2] ?? null,
        },
      }));
    const service = newService({
      connectedAccount: {
        findUnique: vi.fn().mockResolvedValue(inactiveZohoAccount),
      },
      connectedAccountAnalyticsRecord: {
        findMany: vi.fn().mockResolvedValue([
          {
            sourceObjectId: 'campaign-1',
            objectTitle: 'Campaign one',
            objectOccurredAt: new Date('2026-10-15T00:00:00.000Z'),
            retrievedAt: new Date('2026-10-17T00:00:00.000Z'),
            metricValues: metricValues({
              SENT: 110,
              DELIVERED: 100,
              OPEN_RATE: 10,
              UNIQUE_CLICK_RATE: 5,
            }),
          },
          {
            sourceObjectId: 'campaign-2',
            objectTitle: 'Campaign two',
            objectOccurredAt: new Date('2026-10-16T00:00:00.000Z'),
            retrievedAt: new Date('2026-10-17T00:00:00.000Z'),
            metricValues: metricValues({
              SENT: 330,
              DELIVERED: 300,
              OPEN_RATE: 20,
              UNIQUE_CLICK_RATE: 8,
            }),
          },
        ]),
      },
    });

    const report = await service.emailReport(
      'zoho-account',
      '2026-10-01',
      '2026-10-17',
    );

    expect(report.account.active).toBe(false);
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
  });
});

describe('connected account disconnect and data deletion', () => {
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');

  function createDisconnectService(
    provider: 'YOUTUBE' | 'ZOHO_CAMPAIGNS' | 'INSTAGRAM',
    credentials: { accessToken: string; refreshToken?: string },
    relatedAccounts: Array<{ credentialCiphertext: string | null }> = [],
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
    const accountUpdate = vi.fn();
    const prisma = {
      connectedAccount: {
        findUnique: vi.fn().mockResolvedValue(account),
        findMany: vi.fn().mockResolvedValue(relatedAccounts),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditLog: { create: auditCreate },
          connectedAccount: { update: accountUpdate },
        }),
      ),
    };
    const providerClient = {
      revokeCredentials: vi.fn().mockResolvedValue('revoked'),
    };
    return {
      service: newService(prisma, providerClient),
      prisma,
      providerClient,
      auditCreate,
      accountUpdate,
    };
  }

  it('revokes supported credentials and retains analytics when disconnecting', async () => {
    const { service, providerClient, auditCreate, accountUpdate } =
      createDisconnectService('YOUTUBE', {
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
      historicalAnalyticsRetained: true,
      providerAccessRevocation: 'revoked',
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'CONNECTED_ACCOUNT_DISCONNECTED',
          metadata: {
            provider: 'YOUTUBE',
            providerAccessRevocation: 'revoked',
            historicalAnalyticsRetained: true,
          },
        }),
      }),
    );
    expect(accountUpdate).toHaveBeenCalledWith({
      where: { id: 'connected-account-id' },
      data: { active: false, credentialCiphertext: null, tokenExpiresAt: null },
    });
  });

  it('does not revoke a provider grant while another active account uses it', async () => {
    vi.stubEnv('INTEGRATION_TOKEN_ENCRYPTION_KEY', encryptionKey);
    const { service, providerClient } = createDisconnectService(
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

  it('requires disconnect before explicit data deletion and deletes values before records', async () => {
    const order: string[] = [];
    const prisma = {
      connectedAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'account-id',
          provider: 'INSTAGRAM',
          active: false,
        }),
        delete: vi.fn(async () => {
          order.push('account');
        }),
      },
      connectedAccountAnalyticsRecord: {
        findMany: vi.fn().mockResolvedValue([{ id: 'record-1' }]),
        deleteMany: vi.fn(async () => {
          order.push('records');
        }),
      },
      connectedAccountMetricValue: {
        deleteMany: vi.fn(async () => {
          order.push('values');
        }),
      },
      auditLog: { create: vi.fn() },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback(prisma),
      ),
    };
    const service = newService(prisma);
    const result = await service.deleteData('account-id', 'actor-id');
    expect(result).toMatchObject({
      deleted: true,
      historicalAnalyticsDeleted: true,
    });
    expect(order).toEqual(['values', 'records', 'account']);

    prisma.connectedAccount.findUnique.mockResolvedValueOnce({
      id: 'account-id',
      provider: 'INSTAGRAM',
      active: true,
    });
    await expect(
      service.deleteData('account-id', 'actor-id'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
