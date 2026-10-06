import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('returns a healthy response', () => {
    const response = new HealthController().getHealth();
    assert.equal(response.status, 'ok');
    assert.equal(response.service, 'social-media-dashboard-api');
  });
});
