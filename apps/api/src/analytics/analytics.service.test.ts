import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { buildDashboardWhere } from './analytics.service.js';

describe('buildDashboardWhere', () => {
  it('intersects active status, date range, and campaign context filters', () => {
    const where = buildDashboardWhere({
      from: '2026-01-10',
      to: '2026-01-31',
      campaignId: 'campaign-id',
      channelId: 'channel-id',
      platformId: 'platform-id',
    });

    assert.equal(where.status, 'ACTIVE');
    assert.deepEqual(where.recordDate, {
      gte: new Date('2026-01-10T00:00:00.000Z'),
      lte: new Date('2026-01-31T23:59:59.999Z'),
    });
    assert.deepEqual(where.campaignPlatform, {
      campaignChannel: { campaignId: 'campaign-id', channelId: 'channel-id' },
      platformId: 'platform-id',
    });
  });

  it('does not add optional filters when they are absent', () => {
    assert.deepEqual(buildDashboardWhere({}), { status: 'ACTIVE' });
  });
});
