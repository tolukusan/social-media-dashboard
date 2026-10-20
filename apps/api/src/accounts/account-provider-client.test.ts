import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { AccountProviderClient } from './account-provider-client.js';

function readFixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'),
  ) as T;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('account provider read-only analytics', () => {
  it('fetches an Instagram daily-history chunk without profiles or posts and keeps real zeroes', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v99.0');
    const urls: URL[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input.toString());
        urls.push(url);
        return Response.json({
          data: [
            { name: 'views', total_value: { value: 0 } },
            { name: 'reach', total_value: { value: 3 } },
            { name: 'total_interactions', total_value: { value: 1 } },
          ],
        });
      }),
    );

    const result = await new AccountProviderClient().syncMetaAccountMetrics(
      { provider: 'INSTAGRAM', externalAccountId: '123' },
      { accessToken: 'fixture-token' },
      '2026-10-01',
      '2026-10-01',
    );

    expect(result).toContainEqual(
      expect.objectContaining({ code: 'MEDIA_VIEWS', value: 0 }),
    );
    expect(urls).toHaveLength(1);
    expect(urls[0].pathname).toBe('/v99.0/123/insights');
    expect(urls[0].searchParams.get('until')).toBe('2026-10-02');
  });

  it('keeps Facebook organic metrics explicit and snapshots followers on retrieval date', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v99.0');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (
        url.pathname.endsWith('/insights') &&
        url.searchParams.get('metric') === 'page_views_total'
      )
        return Response.json({
          data: [
            {
              name: 'page_views_total',
              values: [{ end_time: '2026-10-01T07:00:00+0000', value: 0 }],
            },
          ],
        });
      if (url.pathname.endsWith('/insights'))
        return Response.json({
          data: [
            {
              name: 'page_media_view',
              values: [
                {
                  end_time: '2026-10-01T07:00:00+0000',
                  is_from_ads: false,
                  value: 0,
                },
                {
                  end_time: '2026-10-01T07:00:00+0000',
                  is_from_ads: true,
                  value: 18,
                },
              ],
            },
          ],
        });
      if (url.pathname.endsWith('/123'))
        return Response.json({ id: '123', followers_count: 42 });
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);
    const client = new AccountProviderClient();

    const metrics = await client.syncMetaAccountMetrics(
      { provider: 'FACEBOOK', externalAccountId: '123' },
      { accessToken: 'fixture-token' },
      '2026-10-01',
      '2026-10-01',
    );
    const snapshot = await client.fetchMetaAudienceSnapshot(
      { provider: 'FACEBOOK', externalAccountId: '123' },
      { accessToken: 'fixture-token' },
      '2026-10-20',
    );

    expect(metrics).toContainEqual(
      expect.objectContaining({ code: 'PAGE_VISITS', value: 0 }),
    );
    expect(metrics).toContainEqual(
      expect.objectContaining({ code: 'ORGANIC_MEDIA_VIEWS', value: 0 }),
    );
    expect(metrics).not.toContainEqual(
      expect.objectContaining({ code: 'ORGANIC_MEDIA_VIEWS', value: 18 }),
    );
    expect(snapshot).toMatchObject({
      date: '2026-10-20',
      code: 'AUDIENCE_SIZE',
      value: 42,
    });
  });

  it('follows Meta cursor pagination without following a provider-supplied URL', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v99.0');
    const pageCursors: Array<string | null> = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      pageCursors.push(url.searchParams.get('after'));
      if (!url.searchParams.has('after'))
        return Response.json({
          data: [{ id: '123', name: 'Page one', access_token: 'page-one' }],
          paging: {
            next: 'https://graph.facebook.com/v99.0/me/accounts?after=cursor-one',
            cursors: { after: 'cursor-one' },
          },
        });
      return Response.json({
        data: [{ id: '456', name: 'Page two', access_token: 'page-two' }],
      });
    });
    vi.stubGlobal('fetch', fetcher);

    const candidates = await new AccountProviderClient().discover('FACEBOOK', {
      accessToken: 'user-token',
    });

    expect(pageCursors).toEqual([null, 'cursor-one']);
    expect(candidates.map((candidate) => candidate.externalAccountId)).toEqual([
      '123',
      '456',
    ]);
  });

  it('follows LinkedIn organization ACL pages before returning managed pages', async () => {
    vi.stubEnv('INTEGRATION_LINKEDIN_API_VERSION', '202610');
    const starts: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/organizationAcls')) {
        const start = url.searchParams.get('start')!;
        starts.push(start);
        return start === '0'
          ? Response.json({
              elements: [
                ...Array.from({ length: 99 }, () => ({ state: 'REVOKED' })),
                {
                  organization: 'urn:li:organization:101',
                  state: 'APPROVED',
                  role: 'ADMINISTRATOR',
                },
              ],
              paging: { total: 101 },
            })
          : Response.json({
              elements: [
                {
                  organization: 'urn:li:organization:102',
                  state: 'APPROVED',
                  role: 'ADMINISTRATOR',
                },
              ],
              paging: { total: 101 },
            });
      }
      if (url.pathname.endsWith('/organizations/101'))
        return Response.json({ localizedName: 'Page one' });
      if (url.pathname.endsWith('/organizations/102'))
        return Response.json({ localizedName: 'Page two' });
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const candidates = await new AccountProviderClient().discover('LINKEDIN', {
      accessToken: 'member-token',
    });

    expect(starts).toEqual(['0', '100']);
    expect(candidates.map((candidate) => candidate.externalAccountId)).toEqual([
      '101',
      '102',
    ]);
  });

  it('follows YouTube channel page tokens when discovering channels', async () => {
    const pageTokens: Array<string | null> = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      pageTokens.push(url.searchParams.get('pageToken'));
      if (!url.searchParams.has('pageToken'))
        return Response.json({
          items: [{ id: 'channel-one', snippet: { title: 'Channel one' } }],
          nextPageToken: 'next-page',
        });
      return Response.json({
        items: [{ id: 'channel-two', snippet: { title: 'Channel two' } }],
      });
    });
    vi.stubGlobal('fetch', fetcher);

    const candidates = await new AccountProviderClient().discover('YOUTUBE', {
      accessToken: 'google-token',
    });

    expect(pageTokens).toEqual([null, 'next-page']);
    expect(candidates.map((candidate) => candidate.externalAccountId)).toEqual([
      'channel-one',
      'channel-two',
    ]);
  });

  it('retries a transient provider response before completing the account sync', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v99.0');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/insights') && fetcher.mock.calls.length === 1)
        return new Response(null, { status: 503 });
      if (url.pathname.endsWith('/insights'))
        return Response.json({ data: [] });
      if (url.pathname.endsWith('/123'))
        return Response.json({ id: '123', followers_count: 42 });
      if (url.pathname.endsWith('/media')) return Response.json({ data: [] });
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'INSTAGRAM',
        externalAccountId: '123',
        credentialCiphertext: 'unused-in-unit-test',
      },
      { accessToken: 'fixture-token' },
      '2026-10-01',
      '2026-10-02',
    );

    expect(
      fetcher.mock.calls.filter(([input]) =>
        new URL(input.toString()).pathname.endsWith('/insights'),
      ),
    ).toHaveLength(3);
    expect(result.metrics).toContainEqual(
      expect.objectContaining({ code: 'AUDIENCE_SIZE', value: 42 }),
    );
  });

  it('does not retry a rate limit when the provider asks for a long wait', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v99.0');
    const fetcher = vi.fn(
      async () =>
        new Response(null, { status: 429, headers: { 'Retry-After': '60' } }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(
      new AccountProviderClient().sync(
        {
          provider: 'INSTAGRAM',
          externalAccountId: '123',
          credentialCiphertext: 'unused-in-unit-test',
        },
        { accessToken: 'fixture-token' },
        '2026-10-01',
        '2026-10-02',
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('uses the configured OAuth callback and read-only YouTube scopes', () => {
    vi.stubEnv('INTEGRATION_GOOGLE_CLIENT_ID', 'test-client-id');
    const url = new URL(
      new AccountProviderClient().authorizationUrl(
        'YOUTUBE',
        'opaque-test-state',
        'https://api.example.test/api/v1/accounts/oauth/callback',
      ),
    );
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('state')).toBe('opaque-test-state');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.test/api/v1/accounts/oauth/callback',
    );
    expect(url.searchParams.get('scope')).toContain('youtube.readonly');
    expect(url.searchParams.get('scope')).toContain('yt-analytics.readonly');
    expect(url.searchParams.get('scope')).not.toContain('youtube.force-ssl');
  });

  it('normalizes channel, daily metric, and top-video data from YouTube', async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (
        url.hostname === 'youtubeanalytics.googleapis.com' &&
        url.searchParams.get('dimensions') === 'day'
      )
        return Response.json({
          columnHeaders: [
            { name: 'day' },
            { name: 'views' },
            { name: 'estimatedMinutesWatched' },
            { name: 'subscribersGained' },
            { name: 'subscribersLost' },
            { name: 'likes' },
          ],
          rows: [['2026-10-13', 51, 120, 4, 1, 9]],
        });
      if (url.hostname === 'youtubeanalytics.googleapis.com')
        return Response.json({
          columnHeaders: [
            { name: 'video' },
            { name: 'views' },
            { name: 'estimatedMinutesWatched' },
            { name: 'likes' },
          ],
          rows: [['video_123', 42, 90, 6]],
        });
      if (
        url.hostname === 'www.googleapis.com' &&
        url.pathname.endsWith('/channels')
      )
        return Response.json({
          items: [
            { id: 'channel_123', statistics: { subscriberCount: '950' } },
          ],
        });
      if (
        url.hostname === 'www.googleapis.com' &&
        url.pathname.endsWith('/videos')
      )
        return Response.json({
          items: [
            {
              id: 'video_123',
              snippet: {
                title: 'Useful video',
                publishedAt: '2026-10-01T09:00:00Z',
              },
            },
          ],
        });
      throw new Error(
        `Unexpected provider endpoint: ${url.origin}${url.pathname}`,
      );
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'YOUTUBE',
        externalAccountId: 'channel_123',
        credentialCiphertext: 'unused-in-unit-test',
      },
      { accessToken: 'fixture-token' },
      '2026-10-01',
      '2026-10-14',
    );

    expect(result.metrics).toContainEqual({
      date: '2026-10-13',
      scope: 'DAILY',
      code: 'VIEWS',
      sourceMetric: 'views',
      value: 51,
    });
    expect(result.metrics).toContainEqual({
      date: '2026-10-14',
      scope: 'SNAPSHOT',
      code: 'AUDIENCE_SIZE',
      sourceMetric: 'statistics.subscriberCount',
      value: 950,
    });
    expect(result.posts).toEqual([
      expect.objectContaining({
        externalPostId: 'video_123',
        title: 'Useful video',
        dataScope: 'DATE_RANGE',
        metricValues: { VIEWS: 42, WATCH_TIME_MINUTES: 90, LIKES: 6 },
      }),
    ]);
    expect(
      fetcher.mock.calls.every(
        ([input]) => new URL(input.toString()).protocol === 'https:',
      ),
    ).toBe(true);
  });

  it('keeps Facebook organic views separate from paid and mixed values', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v23.0');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      const metric = url.searchParams.get('metric');
      if (url.pathname.endsWith('/123') && !url.pathname.endsWith('/insights'))
        return Response.json({
          id: '123',
          name: 'Example Page',
          followers_count: 400,
        });
      if (metric === 'page_views_total')
        return Response.json({
          data: [
            {
              name: 'page_views_total',
              values: [{ end_time: '2026-10-14T07:00:00+0000', value: 31 }],
            },
          ],
        });
      if (metric === 'page_media_view')
        return Response.json({
          data: [
            {
              name: 'page_media_view',
              values: [
                {
                  end_time: '2026-10-14T07:00:00+0000',
                  value: 21,
                  breakdowns: ['false'],
                },
                {
                  end_time: '2026-10-14T07:00:00+0000',
                  value: 73,
                  breakdowns: ['true'],
                },
                {
                  end_time: '2026-10-14T07:00:00+0000',
                  value: 100,
                  breakdowns: [],
                },
              ],
            },
          ],
        });
      if (url.pathname.endsWith('/published_posts'))
        return Response.json({ data: [] });
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'FACEBOOK',
        externalAccountId: '123',
        credentialCiphertext: 'unused-in-unit-test',
      },
      { accessToken: 'fixture-token' },
      '2026-10-14',
      '2026-10-14',
    );

    expect(result.metrics).toContainEqual({
      date: '2026-10-14',
      scope: 'DAILY',
      code: 'ORGANIC_MEDIA_VIEWS',
      sourceMetric: 'page_media_view:is_from_ads=false',
      value: 21,
    });
    expect(
      result.metrics.some(
        (metric) => metric.value === 73 || metric.value === 100,
      ),
    ).toBe(false);
  });

  it('normalizes Instagram account insights, audience, and media from a golden payload', async () => {
    vi.stubEnv('INTEGRATION_META_API_VERSION', 'v23.0');
    const fixture = readFixture<{
      accountInsights: unknown;
      profile: unknown;
      media: unknown;
      mediaInsights: unknown;
    }>('instagram-account.json');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/17841400000000001/insights'))
        return Response.json(fixture.accountInsights);
      if (url.pathname.endsWith('/17841400000000001/media'))
        return Response.json(fixture.media);
      if (url.pathname.endsWith('/17900000000000001/insights'))
        return Response.json(fixture.mediaInsights);
      if (url.pathname.endsWith('/17841400000000001'))
        return Response.json(fixture.profile);
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'INSTAGRAM',
        externalAccountId: '17841400000000001',
        credentialCiphertext: 'unused-in-unit-test',
      },
      { accessToken: 'fixture-token' },
      '2026-10-14',
      '2026-10-14',
    );

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          date: '2026-10-14',
          scope: 'DAILY',
          code: 'MEDIA_VIEWS',
          value: 142,
        }),
        expect.objectContaining({
          date: '2026-10-14',
          scope: 'DAILY',
          code: 'ACCOUNTS_REACHED',
          value: 93,
        }),
        expect.objectContaining({
          date: '2026-10-20',
          scope: 'SNAPSHOT',
          code: 'AUDIENCE_SIZE',
          value: 812,
        }),
      ]),
    );
    expect(result.posts).toEqual([
      expect.objectContaining({
        externalPostId: '17900000000000001',
        title: 'A useful fixture caption',
        permalink: 'https://www.instagram.com/p/fixture-post/',
        dataScope: 'LIFETIME',
        metricValues: { VIEWS: 38, REACH: 25, INTERACTIONS: 7 },
      }),
    ]);
    expect(result.emailCampaigns).toEqual([]);
    expect(result.caveats).toContain(
      'Top-content ranking is based on up to 20 eligible media items synced for the selected period.',
    );
    expect(
      fetcher.mock.calls.every(
        ([input]) => new URL(input.toString()).protocol === 'https:',
      ),
    ).toBe(true);
  });

  it('normalizes LinkedIn page, organic follower, and post statistics from a golden payload', async () => {
    vi.stubEnv('INTEGRATION_LINKEDIN_API_VERSION', '202610');
    const fixture = readFixture<{
      pageStats: { elements: Array<{ timeRange: { start: number } }> };
      followerStats: { elements: Array<{ timeRange: { start: number } }> };
      shareStats: { elements: Array<{ timeRange: { start: number } }> };
      posts: { elements: Array<{ publishedAt: string }> };
      postStats: unknown;
    }>('linkedin-organization.json');
    const day = new Date().toISOString().slice(0, 10);
    const start = Date.parse(`${day}T00:00:00.000Z`);
    for (const response of [
      fixture.pageStats,
      fixture.followerStats,
      fixture.shareStats,
    ])
      for (const entry of response.elements) entry.timeRange.start = start;
    fixture.posts.elements[0].publishedAt = `${day}T11:00:00.000Z`;

    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/organizationPageStatistics'))
        return Response.json(fixture.pageStats);
      if (url.pathname.endsWith('/organizationalEntityFollowerStatistics'))
        return Response.json(fixture.followerStats);
      if (url.pathname.endsWith('/organizationalEntityShareStatistics'))
        return Response.json(
          url.searchParams.has('shares')
            ? fixture.postStats
            : fixture.shareStats,
        );
      if (url.pathname.endsWith('/posts')) return Response.json(fixture.posts);
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'LINKEDIN',
        externalAccountId: '987654',
        credentialCiphertext: 'unused-in-unit-test',
      },
      {
        accessToken: 'fixture-token',
        providerData: { organizationUrn: 'urn:li:organization:987654' },
      },
      day,
      day,
    );

    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'PAGE_VIEWS', value: 45 }),
        expect.objectContaining({ code: 'ORGANIC_NEW_FOLLOWERS', value: 4 }),
        expect.objectContaining({
          code: 'ORGANIC_POST_IMPRESSIONS',
          value: 61,
        }),
      ]),
    );
    expect(result.metrics.some((metric) => metric.value === 99)).toBe(false);
    expect(result.caveats).toContain(
      'Top-content ranking is based on up to 20 eligible posts; post metadata is available for only six weeks.',
    );
    expect(result.posts).toEqual([
      expect.objectContaining({
        externalPostId: 'urn:li:share:fixture123',
        title: 'A LinkedIn fixture post',
        dataScope: 'LIFETIME',
        metricValues: expect.objectContaining({
          ORGANIC_POST_IMPRESSIONS: 61,
          ORGANIC_POST_CLICKS: 5,
          ORGANIC_POST_LIKES: 8,
        }),
      }),
    ]);
    expect(result.emailCampaigns).toEqual([]);
  });

  it('keeps Zoho Campaigns totals in cumulative email reports from a golden payload', async () => {
    vi.stubEnv('INTEGRATION_ZOHO_REGION', 'US');
    const fixture = readFixture<{
      recentCampaigns: unknown;
      campaignReport: unknown;
    }>('zoho-campaigns.json');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/recentcampaigns'))
        return Response.json(fixture.recentCampaigns);
      if (url.pathname.endsWith('/campaignreports'))
        return Response.json(fixture.campaignReport);
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'ZOHO_CAMPAIGNS',
        externalAccountId: 'ZOHO_CAMPAIGNS_US',
        credentialCiphertext: 'unused-in-unit-test',
      },
      { accessToken: 'fixture-token', providerData: { region: 'US' } },
      '2026-10-01',
      '2026-10-31',
    );

    expect(result.emailCampaigns).toEqual([
      {
        externalCampaignId: 'campaign_fixture_001',
        campaignName: 'October product update',
        sentAt: '2026-10-14T09:30:00.000Z',
        metricValues: {
          SENT: 1200,
          DELIVERED: 1172,
          OPENS: 402,
          UNIQUE_CLICKS: 87,
          OPEN_RATE: 34.3,
          UNIQUE_CLICK_RATE: 7.42,
          BOUNCES: 28,
          UNSUBSCRIBES: 3,
        },
      },
    ]);
    expect(result.metrics).toEqual([]);
    expect(result.posts).toEqual([]);
    expect(result.caveats.join(' ')).toContain('not daily observations');
  });

  it('paginates sent Zoho campaigns, filters by the selected date range, and deduplicates IDs', async () => {
    vi.stubEnv('INTEGRATION_ZOHO_REGION', 'US');
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      campaign_key:
        index === 0 ? 'campaign_october_one' : `campaign_old_${index}`,
      campaign_name: index === 0 ? 'October campaign one' : 'Older campaign',
      sent_time:
        index === 0 ? '2026-10-14T09:30:00.000Z' : '2026-08-01T09:30:00.000Z',
    }));
    const secondPage = [
      {
        campaign_key: 'campaign_october_two',
        campaign_name: 'October campaign two',
        sent_time: '2026-10-10T09:30:00.000Z',
      },
    ];
    const listCalls: URL[] = [];
    const reportCalls: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/recentcampaigns')) {
        listCalls.push(url);
        const page =
          url.searchParams.get('fromindex') === '1' ? firstPage : secondPage;
        return Response.json({
          status: 'success',
          recent_campaigns: { campaigns: page },
        });
      }
      if (url.pathname.endsWith('/campaignreports')) {
        const key = url.searchParams.get('campaignkey')!;
        reportCalls.push(key);
        return Response.json({
          status: 'success',
          'campaign-reports': [
            {
              campaign_name: key,
              emails_sent_count: 10,
              delivered_count: 9,
            },
          ],
        });
      }
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().sync(
      {
        provider: 'ZOHO_CAMPAIGNS',
        externalAccountId: 'ZOHO_CAMPAIGNS_US',
        credentialCiphertext: 'unused-in-unit-test',
      },
      { accessToken: 'fixture-token', providerData: { region: 'US' } },
      '2026-10-01',
      '2026-10-17',
    );

    expect(listCalls).toHaveLength(2);
    expect(listCalls.map((url) => url.searchParams.get('fromindex'))).toEqual([
      '1',
      '101',
    ]);
    expect(
      listCalls.every((url) => url.searchParams.get('status') === 'sent'),
    ).toBe(true);
    expect(
      listCalls.every((url) => url.searchParams.get('range') === '100'),
    ).toBe(true);
    expect(reportCalls).toEqual([
      'campaign_october_one',
      'campaign_october_two',
    ]);
    expect(
      result.emailCampaigns.map((campaign) => campaign.externalCampaignId),
    ).toEqual(reportCalls);
  });

  it('fails a Zoho sync when a campaign report keeps returning a provider error', async () => {
    vi.stubEnv('INTEGRATION_ZOHO_REGION', 'US');
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith('/recentcampaigns'))
        return Response.json({
          status: 'success',
          recent_campaigns: {
            campaigns: [
              {
                campaign_key: 'campaign_temporary_failure',
                campaign_name: 'Temporary failure fixture',
                sent_time: '2026-10-14T09:30:00.000Z',
              },
            ],
          },
        });
      if (url.pathname.endsWith('/campaignreports'))
        return new Response(null, { status: 503 });
      throw new Error(`Unexpected provider endpoint: ${url.href}`);
    });
    vi.stubGlobal('fetch', fetcher);

    await expect(
      new AccountProviderClient().sync(
        {
          provider: 'ZOHO_CAMPAIGNS',
          externalAccountId: 'ZOHO_CAMPAIGNS_US',
          credentialCiphertext: 'unused-in-unit-test',
        },
        { accessToken: 'fixture-token', providerData: { region: 'US' } },
        '2026-10-01',
        '2026-10-17',
      ),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});

describe('provider access revocation', () => {
  it('revokes the YouTube refresh token through Google OAuth', async () => {
    const fetcher = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) => {
        expect(new URL(_input.toString()).href).toBe(
          'https://oauth2.googleapis.com/revoke',
        );
        expect(init?.method).toBe('POST');
        expect(String(init?.body)).toBe('token=google-refresh-token');
        return new Response(null, { status: 200 });
      },
    );
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().revokeCredentials(
      'YOUTUBE',
      {
        accessToken: 'google-access-token',
        refreshToken: 'google-refresh-token',
      },
    );

    expect(result).toBe('revoked');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('revokes Zoho refresh tokens against the configured data center', async () => {
    vi.stubEnv('INTEGRATION_ZOHO_CLIENT_ID', 'zoho-client');
    vi.stubEnv('INTEGRATION_ZOHO_CLIENT_SECRET', 'zoho-secret');
    const fetcher = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(new URL(input.toString()).href).toBe(
          'https://accounts.zoho.eu/oauth/v2/revoke/token',
        );
        expect(new Headers(init?.headers).get('authorization')).toBe(
          `Basic ${Buffer.from('zoho-client:zoho-secret').toString('base64')}`,
        );
        expect(String(init?.body)).toBe('token=zoho-refresh-token');
        return Response.json({});
      },
    );
    vi.stubGlobal('fetch', fetcher);

    const result = await new AccountProviderClient().revokeCredentials(
      'ZOHO_CAMPAIGNS',
      {
        accessToken: 'zoho-access-token',
        refreshToken: 'zoho-refresh-token',
        providerData: { region: 'EU' },
      },
    );

    expect(result).toBe('revoked');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('reports an already inactive Google grant without exposing provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ error: 'invalid_token' }, { status: 400 }),
      ),
    );

    await expect(
      new AccountProviderClient().revokeCredentials('YOUTUBE', {
        accessToken: 'expired-token',
      }),
    ).resolves.toBe('already_inactive');
  });

  it('leaves Meta and LinkedIn grants for provider-side revocation', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const client = new AccountProviderClient();

    await expect(
      client.revokeCredentials('INSTAGRAM', { accessToken: 'page-token' }),
    ).resolves.toBe('not_supported');
    await expect(
      client.revokeCredentials('LINKEDIN', { accessToken: 'linkedin-token' }),
    ).resolves.toBe('not_supported');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
