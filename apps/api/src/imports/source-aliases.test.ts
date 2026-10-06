import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { detectSource, suggestedMapping } from './source-aliases.js';
import { detectSourceAdapter } from './source-adapters.js';

describe('source aliases', () => {
  it('suggests deterministic stakeholder mappings', () => {
    assert.deepEqual(
      suggestedMapping([
        'Date',
        'Content interactions',
        'Facebook views',
        'Facebook visits',
      ]),
      {
        Date: 'recordDate',
        'Content interactions': 'SM_ENGAGEMENTS',
        'Facebook views': 'SM_VIEWS',
        'Facebook visits': 'SM_PROFILE_VISITS',
      },
    );
  });

  it('detects email tabular exports', () => {
    assert.deepEqual(
      detectSource(['Campaign name', 'Sent', 'Opened', 'Delivered']),
      { type: 'EMAIL', platform: 'EMAIL' },
    );
  });

  it('selects a deterministic source adapter without AI', () => {
    assert.equal(
      detectSourceAdapter(['Date', 'Facebook Views']).code,
      'FACEBOOK_META',
    );
    assert.equal(
      detectSourceAdapter(['Campaign name', 'Sent', 'Opened']).code,
      'EMAIL',
    );
  });
});
