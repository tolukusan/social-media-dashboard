import assert from 'node:assert/strict';
import { it as test } from 'vitest';
import { ChannelsService } from './channels.service.js';

test('platform catalogue creates a platform under an active channel', async () => {
  let created: Record<string, unknown> | undefined;
  const db = {
    marketingChannel: {
      findUnique: async () => ({ id: 'channel-1', active: true }),
    },
    platform: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created = data;
        return { id: 'platform-1', ...data };
      },
    },
    auditLog: { create: async () => ({}) },
  };
  const service = new ChannelsService({
    ...db,
    $transaction: async (work: (tx: typeof db) => unknown) => work(db),
  } as never);

  const result = await service.createPlatform(
    {
      channelId: 'channel-1',
      code: ' linkedIn ',
      name: ' LinkedIn ',
    },
    'admin-1',
  );

  assert.equal(result.id, 'platform-1');
  assert.deepEqual(created, {
    channelId: 'channel-1',
    code: 'LINKEDIN',
    name: 'LinkedIn',
    description: undefined,
  });
});

test('platform catalogue deactivation is reversible without deleting the row', async () => {
  let updated: Record<string, unknown> | undefined;
  const db = {
    platform: {
      findUnique: async () => ({
        id: 'platform-1',
        channelId: 'channel-1',
        active: true,
        archivedAt: null,
      }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updated = data;
        return { id: 'platform-1', ...data };
      },
    },
    marketingChannel: {
      findUnique: async () => ({ id: 'channel-1', active: true }),
    },
    auditLog: { create: async () => ({}) },
  };
  const service = new ChannelsService({
    ...db,
    $transaction: async (work: (tx: typeof db) => unknown) => work(db),
  } as never);

  await service.updatePlatform('platform-1', { active: false }, 'admin-1');
  assert.equal(updated?.active, false);
  assert.ok(updated?.archivedAt);
});

test('platform with campaign references cannot be moved between channels', async () => {
  let updated = false;
  const service = new ChannelsService({
    platform: {
      findUnique: async () => ({
        id: 'platform-1',
        channelId: 'channel-1',
        active: true,
        archivedAt: null,
      }),
      update: async () => {
        updated = true;
        return {};
      },
    },
    marketingChannel: {
      findUnique: async () => ({ id: 'channel-2', active: true }),
    },
    campaignPlatform: { count: async () => 1 },
  } as never);

  await assert.rejects(
    service.updatePlatform('platform-1', { channelId: 'channel-2' }, 'admin-1'),
    (error: unknown) =>
      Boolean(
        error &&
        typeof error === 'object' &&
        'getResponse' in error &&
        (error as { getResponse: () => { code: string } }).getResponse()
          .code === 'PLATFORM_CHANNEL_IN_USE',
      ),
  );
  assert.equal(updated, false);
});
