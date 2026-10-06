import 'reflect-metadata';
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { validate } from 'class-validator';
import { CreateCampaignDto } from './campaigns/dto/create-campaign.dto.js';
import { CreatePerformanceDto } from './performance/dto/create-performance.dto.js';
import { CreateTargetDto } from './targets/dto/create-target.dto.js';

async function invalid(dto: object) {
  return (await validate(dto)).length > 0;
}

describe('validation matrix', () => {
  it('rejects invalid dates and malformed campaign references', async () => {
    const dto = Object.assign(new CreateCampaignDto(), {
      name: 'A',
      startDate: 'not-a-date',
      responsibleUserId: 'bad',
      channels: [],
    });
    assert.equal(await invalid(dto), true);
  });

  it('rejects missing performance record identity and raw values', async () => {
    const dto = Object.assign(new CreatePerformanceDto(), {
      campaignPlatformId: 'bad',
      recordDate: 'not-a-date',
    });
    assert.equal(await invalid(dto), true);
  });

  it('rejects invalid target scope identifiers and date input', async () => {
    const dto = Object.assign(new CreateTargetDto(), {
      kpiDefinitionId: 'bad',
      scopeType: 'CHANNEL',
      periodType: 'MONTHLY',
      targetValue: -1,
      comparisonRule: 'HIGHER_IS_BETTER',
      effectiveFrom: 'bad',
    });
    assert.equal(await invalid(dto), true);
  });
});
