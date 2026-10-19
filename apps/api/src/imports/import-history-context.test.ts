import { describe, expect, it } from 'vitest';
import { attachImportCampaignContext } from './import-history-context.js';

describe('attachImportCampaignContext', () => {
  it('marks deleted campaign links and keeps current campaign names', () => {
    const batches = [{ id: 'batch-1' }, { id: 'batch-2' }, { id: 'batch-3' }];
    const links = [
      {
        batchId: 'batch-1',
        campaignId: 'campaign-current',
        campaignName: 'Spring launch',
        state: 'CURRENT' as const,
      },
      {
        batchId: 'batch-1',
        campaignId: 'campaign-deleted',
        campaignName: null,
        state: 'DELETED' as const,
      },
      {
        batchId: 'batch-1',
        campaignId: 'campaign-deleted',
        campaignName: null,
        state: 'DELETED' as const,
      },
    ];

    expect(attachImportCampaignContext(batches, links)).toEqual([
      {
        id: 'batch-1',
        currentCampaignNames: ['Spring launch'],
        deletedCampaignCount: 1,
      },
      { id: 'batch-2', currentCampaignNames: [], deletedCampaignCount: 0 },
      { id: 'batch-3', currentCampaignNames: [], deletedCampaignCount: 0 },
    ]);
  });
});
