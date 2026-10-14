import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProviderClient } from './account-provider-client.js';

afterEach(() => vi.unstubAllGlobals());

describe('account provider read-only analytics', () => {
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
});
