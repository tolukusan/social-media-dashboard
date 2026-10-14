import { describe, expect, it, vi } from 'vitest';
import { ConnectedAccountsService } from './connected-accounts.service.js';

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
