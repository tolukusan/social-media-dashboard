import { describe, expect, it } from 'vitest';
import { getAdminSeedAction } from './seed-admin-policy.js';

describe('getAdminSeedAction', () => {
  it('creates a production administrator only when no administrator exists', () => {
    expect(
      getAdminSeedAction({
        production: true,
        administratorExists: false,
        credentialsConfigured: true,
      }),
    ).toBe('create');
  });

  it('never updates an existing production administrator during seeding', () => {
    expect(
      getAdminSeedAction({
        production: true,
        administratorExists: true,
        credentialsConfigured: true,
      }),
    ).toBe('skip');
  });

  it('preserves local administrator upsert behavior', () => {
    expect(
      getAdminSeedAction({
        production: false,
        administratorExists: true,
        credentialsConfigured: true,
      }),
    ).toBe('upsert');
  });

  it('does not create an administrator without configured credentials', () => {
    expect(
      getAdminSeedAction({
        production: true,
        administratorExists: false,
        credentialsConfigured: false,
      }),
    ).toBe('skip');
  });
});
