import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderClient } from './provider-client.js';
import {
  configuration,
  day,
  numeric,
  sourceToday,
} from './integration-contract.js';
import type { SourceConnection } from './integration-contract.js';

const connection: SourceConnection = {
  provider: 'FACEBOOK_ADS',
  externalAccountId: '123',
  credentialReference: 'INTEGRATION_TEST_ACCESS_TOKEN',
  sourceTimezone: 'Africa/Lagos',
  currency: 'NGN',
  region: 'US',
};
const row = (publisher = 'facebook') => ({
  account_id: '123',
  campaign_id: '456',
  account_currency: 'NGN',
  publisher_platform: publisher,
  date_start: '2024-05-01',
  date_stop: '2024-05-01',
  impressions: '100',
  clicks: '4',
  spend: '12.5',
});
function credentials() {
  vi.stubEnv(connection.credentialReference, 'fixture-token');
  vi.stubEnv('INTEGRATION_META_API_VERSION', 'v23.0');
  vi.stubEnv('INTEGRATION_LINKEDIN_API_VERSION', '202608');
}
function mockFetch(responder: (url: URL) => unknown) {
  const fetcher = vi.fn(async (url: URL) =>
    Response.json(responder(new URL(url))),
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
const account = { currency: 'NGN', timezone_name: 'Africa/Lagos' };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('read-only provider contracts', () => {
  it('does not call providers without credentials or a version and cannot reference unrelated environment secrets', async () => {
    vi.stubEnv(connection.credentialReference, '');
    const fetcher = mockFetch(() => ({}));
    expect(configuration(connection)).toEqual({
      ready: false,
      code: 'CREDENTIALS_REQUIRED',
    });
    expect(
      configuration({ ...connection, credentialReference: 'DATABASE_URL' })
        .ready,
    ).toBe(false);
    await expect(
      new ProviderClient().fetchCampaign(
        connection,
        '456',
        '2024-05-01',
        '2024-05-01',
      ),
    ).rejects.toMatchObject({ code: 'CREDENTIALS_REQUIRED' });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv(connection.credentialReference, 'fixture-token');
    vi.stubEnv('INTEGRATION_META_API_VERSION', '');
    expect(configuration(connection).code).toBe('API_VERSION_REQUIRED');
  });

  it.each(['FACEBOOK_ADS', 'INSTAGRAM_ADS'] as const)(
    'filters the publisher partition for %s and requests a daily campaign scope',
    async (provider) => {
      credentials();
      const fetcher = mockFetch((url) =>
        url.pathname.endsWith('/insights')
          ? { data: [row('facebook'), row('instagram')] }
          : account,
      );
      const result = await new ProviderClient().fetchCampaign(
        { ...connection, provider },
        '456',
        '2024-05-01',
        '2024-05-01',
      );
      expect(result.observations).toEqual([
        {
          date: '2024-05-01',
          values: { ADS_IMPRESSIONS: 100, ADS_CLICKS: 4, ADS_SPEND: 12.5 },
        },
      ]);
      const requestUrl = new URL(fetcher.mock.calls[1][0]);
      expect(requestUrl.origin).toBe('https://graph.facebook.com');
      expect(requestUrl.searchParams.get('time_increment')).toBe('1');
      expect(requestUrl.searchParams.get('breakdowns')).toBe(
        'publisher_platform',
      );
      expect(requestUrl.searchParams.has('access_token')).toBe(false);
    },
  );

  it('uses cursors on a fixed origin rather than fetching provider pagination URLs', async () => {
    credentials();
    const fetcher = mockFetch((url) =>
      !url.pathname.endsWith('/insights')
        ? account
        : url.searchParams.has('after')
          ? { data: [] }
          : {
              data: [row()],
              paging: {
                next: 'https://untrusted.invalid/?access_token=secret',
                cursors: { after: 'cursor' },
              },
            },
    );
    expect(
      (
        await new ProviderClient().fetchCampaign(
          connection,
          '456',
          '2024-05-01',
          '2024-05-02',
        )
      ).observations,
    ).toHaveLength(1);
    expect(
      fetcher.mock.calls.every(
        ([url]) => new URL(url).origin === 'https://graph.facebook.com',
      ),
    ).toBe(true);
  });

  it.each([
    [{ ...row(), account_id: '999' }, 'PROVIDER_SCOPE_MISMATCH'],
    [{ ...row(), date_stop: '2024-05-02' }, 'PROVIDER_SCOPE_MISMATCH'],
    [{ ...row(), account_currency: 'USD' }, 'PROVIDER_CURRENCY_MISMATCH'],
    [{ ...row(), impressions: '-1' }, 'INVALID_PROVIDER_METRIC'],
  ])(
    'rejects wrong scope, cumulative rows, currency, and invalid counts',
    async (fixture, code) => {
      credentials();
      mockFetch((url) =>
        url.pathname.endsWith('/insights') ? { data: [fixture] } : account,
      );
      await expect(
        new ProviderClient().fetchCampaign(
          connection,
          '456',
          '2024-05-01',
          '2024-05-02',
        ),
      ).rejects.toMatchObject({ code });
    },
  );

  it('keeps an empty source response missing and preserves observed zero without inventing absent metrics', async () => {
    credentials();
    mockFetch((url) =>
      url.pathname.endsWith('/insights')
        ? {
            data: [
              {
                ...row(),
                clicks: undefined,
                impressions: '0',
                spend: undefined,
              },
            ],
          }
        : account,
    );
    expect(
      (
        await new ProviderClient().fetchCampaign(
          connection,
          '456',
          '2024-05-01',
          '2024-05-01',
        )
      ).observations[0].values,
    ).toEqual({ ADS_IMPRESSIONS: 0 });
    mockFetch((url) =>
      url.pathname.endsWith('/insights') ? { data: [] } : account,
    );
    expect(
      (
        await new ProviderClient().fetchCampaign(
          connection,
          '456',
          '2024-05-01',
          '2024-05-01',
        )
      ).observations,
    ).toEqual([]);
  });

  it('requests LinkedIn campaign ownership, currency, and DAILY raw metrics', async () => {
    credentials();
    mockFetch((url) =>
      url.pathname.includes('adCampaigns')
        ? { account: 'urn:li:sponsoredAccount:123' }
        : url.pathname.includes('adAccounts')
          ? { currency: 'NGN' }
          : {
              elements: [
                {
                  dateRange: {
                    start: { year: 2024, month: 5, day: 1 },
                    end: { year: 2024, month: 5, day: 1 },
                  },
                  pivotValues: ['urn:li:sponsoredCampaign:456'],
                  impressions: 100,
                  clicks: 4,
                  costInLocalCurrency: '12.5000004',
                },
              ],
            },
    );
    expect(
      (
        await new ProviderClient().fetchCampaign(
          { ...connection, provider: 'LINKEDIN_ADS', sourceTimezone: 'UTC' },
          '456',
          '2024-05-01',
          '2024-05-01',
        )
      ).observations[0].values,
    ).toEqual({ ADS_IMPRESSIONS: 100, ADS_CLICKS: 4, ADS_SPEND: 12.5 });
  });

  it('retains Zoho cumulative totals as a snapshot without turning percentages or totals into daily analytics', async () => {
    credentials();
    const fetcher = mockFetch(() => ({
      status: 'success',
      'campaign-reports': [
        {
          emails_sent_count: '10',
          delivered_count: '9',
          opens_count: '5',
          unique_clicks_count: '2',
          open_percent: '55',
          secret: 'must not persist',
        },
      ],
    }));
    const result = await new ProviderClient().fetchCampaign(
      { ...connection, provider: 'ZOHO_CAMPAIGNS', region: 'EU' },
      'campaign-key',
      '2024-05-01',
      '2024-05-02',
    );
    expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe(
      'campaigns.zoho.eu',
    );
    expect(result.observations).toEqual([]);
    expect(result.snapshot).toEqual({
      scope: 'CUMULATIVE_CAMPAIGN',
      externalCampaignId: 'campaign-key',
      values: {
        EMAIL_SENT: 10,
        EMAIL_DELIVERED: 9,
        EMAIL_OPENS: 5,
        EMAIL_CLICKS: 2,
      },
    });
  });

  it.each([401, 403, 429, 500])(
    'sanitises HTTP %s provider error bodies',
    async (status) => {
      credentials();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response('provider-secret-password', { status })),
      );
      await expect(
        new ProviderClient().fetchCampaign(
          connection,
          '456',
          '2024-05-01',
          '2024-05-01',
        ),
      ).rejects.not.toThrow('provider-secret-password');
    },
  );

  it('uses source calendar boundaries and rejects impossible dates and fractional counts', () => {
    expect(sourceToday('Africa/Lagos', new Date('2024-05-01T23:30:00Z'))).toBe(
      '2024-05-02',
    );
    expect(() => day('2024-02-30')).toThrow();
    expect(() => numeric('1.5')).toThrow();
  });
});
