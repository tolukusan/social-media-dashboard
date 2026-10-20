import { Injectable } from '@nestjs/common';
import type {
  ConnectedAccountProvider,
  EmailCampaignObservation,
  MetricObservation,
  OAuthCredentials,
  PostObservation,
  ProviderAccessRevocation,
  ProviderSyncResult,
} from './account-contract.js';
import {
  AccountProviderFailure,
  dateFromTimestamp,
  metricNumber,
  providerFailure,
  record,
  records,
  validDay,
} from './account-contract.js';

const zohoDomains: Record<string, string> = {
  US: 'zoho.com',
  EU: 'zoho.eu',
  IN: 'zoho.in',
  AU: 'zoho.com.au',
  JP: 'zoho.jp',
  CN: 'zoho.com.cn',
};

export type ConnectedCandidate = {
  provider: ConnectedAccountProvider;
  kind: 'SOCIAL' | 'EMAIL';
  externalAccountId: string;
  displayName: string;
  handle: string | null;
  profileUrl: string | null;
  profileMetadataExpiresAt: Date | null;
  credentials: OAuthCredentials;
  tokenExpiresAt: Date | null;
};

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function reportingDay(at = new Date()) {
  const timezone = process.env.REPORTING_TIMEZONE ?? 'Africa/Lagos';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return validDay(`${get('year')}-${get('month')}-${get('day')}`);
}

function expiryFromToken(payload: Record<string, unknown>): Date | null {
  const seconds = Number(payload.expires_in);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(Date.now() + seconds * 1000)
    : null;
}

function tokenCredentials(payload: Record<string, unknown>): OAuthCredentials {
  const accessToken = stringValue(payload.access_token);
  if (!accessToken)
    providerFailure(
      'TOKEN_EXCHANGE_FAILED',
      'The provider did not return an access token.',
    );
  const refreshToken = stringValue(payload.refresh_token);
  const expiresAt = expiryFromToken(payload)?.toISOString();
  return {
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(expiresAt ? { expiresAt } : {}),
  };
}

function text(value: unknown, max = 500) {
  if (typeof value !== 'string') return null;
  const safe = value.replace(/\u0000/g, '').trim();
  return safe ? safe.slice(0, max) : null;
}

function providerDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

@Injectable()
export class AccountProviderClient {
  sourceApiVersion(provider: ConnectedAccountProvider) {
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK')
      return `Meta Graph ${process.env.INTEGRATION_META_API_VERSION ?? 'configured-version'}`;
    if (provider === 'LINKEDIN')
      return (
        process.env.INTEGRATION_LINKEDIN_API_VERSION ??
        'LinkedIn API version configured by app'
      );
    if (provider === 'YOUTUBE') return 'YouTube Data API v3 / Analytics API v2';
    return 'Zoho Campaigns API v1.1';
  }

  private timeoutMs = 12_000;

  authorizationUrl(
    provider: ConnectedAccountProvider,
    state: string,
    redirectUri: string,
  ) {
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK') {
      const version = process.env.INTEGRATION_META_API_VERSION!;
      const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
      url.searchParams.set('client_id', process.env.INTEGRATION_META_APP_ID!);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);
      url.searchParams.set(
        'scope',
        provider === 'INSTAGRAM'
          ? 'pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights'
          : 'pages_show_list,pages_read_engagement,read_insights',
      );
      url.searchParams.set('auth_type', 'rerequest');
      return url.toString();
    }
    if (provider === 'LINKEDIN') {
      const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
      url.searchParams.set('response_type', 'code');
      url.searchParams.set(
        'client_id',
        process.env.INTEGRATION_LINKEDIN_CLIENT_ID!,
      );
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set(
        'scope',
        'openid profile rw_organization_admin r_organization_social',
      );
      return url.toString();
    }
    if (provider === 'YOUTUBE') {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.searchParams.set(
        'client_id',
        process.env.INTEGRATION_GOOGLE_CLIENT_ID!,
      );
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('state', state);
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('prompt', 'consent');
      url.searchParams.set(
        'scope',
        'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly',
      );
      return url.toString();
    }
    const region = process.env.INTEGRATION_ZOHO_REGION!;
    const domain = zohoDomains[region];
    if (!domain)
      providerFailure(
        'PROVIDER_CONFIGURATION_REQUIRED',
        'Choose a supported Zoho data center before connecting.',
      );
    const url = new URL(`https://accounts.${domain}/oauth/v2/auth`);
    url.searchParams.set('client_id', process.env.INTEGRATION_ZOHO_CLIENT_ID!);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('scope', 'ZohoCampaigns.campaign.READ');
    return url.toString();
  }

  async exchangeCode(
    provider: ConnectedAccountProvider,
    code: string,
    redirectUri: string,
  ): Promise<OAuthCredentials> {
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK') {
      const version = process.env.INTEGRATION_META_API_VERSION!;
      const shortUrl = new URL(
        `https://graph.facebook.com/${version}/oauth/access_token`,
      );
      for (const [key, value] of Object.entries({
        client_id: process.env.INTEGRATION_META_APP_ID!,
        client_secret: process.env.INTEGRATION_META_APP_SECRET!,
        redirect_uri: redirectUri,
        code,
      }))
        shortUrl.searchParams.set(key, value);
      const shortToken = await this.requestJson(
        shortUrl,
        undefined,
        {},
        'BEARER',
      );
      const shortCredentials = tokenCredentials(shortToken);
      const longUrl = new URL(
        `https://graph.facebook.com/${version}/oauth/access_token`,
      );
      for (const [key, value] of Object.entries({
        grant_type: 'fb_exchange_token',
        client_id: process.env.INTEGRATION_META_APP_ID!,
        client_secret: process.env.INTEGRATION_META_APP_SECRET!,
        fb_exchange_token: shortCredentials.accessToken,
      }))
        longUrl.searchParams.set(key, value);
      try {
        const longToken = await this.requestJson(
          longUrl,
          undefined,
          {},
          'BEARER',
        );
        return tokenCredentials(longToken);
      } catch {
        // Some test-mode Meta apps do not permit long-lived token exchange.
        // The original token remains server-side and the next API call will
        // tell the user if it expired.
        return shortCredentials;
      }
    }

    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });
    if (provider === 'LINKEDIN') {
      form.set('client_id', process.env.INTEGRATION_LINKEDIN_CLIENT_ID!);
      form.set(
        'client_secret',
        process.env.INTEGRATION_LINKEDIN_CLIENT_SECRET!,
      );
      return tokenCredentials(
        await this.requestForm(
          new URL('https://www.linkedin.com/oauth/v2/accessToken'),
          form,
        ),
      );
    }
    if (provider === 'YOUTUBE') {
      form.set('client_id', process.env.INTEGRATION_GOOGLE_CLIENT_ID!);
      form.set('client_secret', process.env.INTEGRATION_GOOGLE_CLIENT_SECRET!);
      return tokenCredentials(
        await this.requestForm(
          new URL('https://oauth2.googleapis.com/token'),
          form,
        ),
      );
    }
    const domain = zohoDomains[process.env.INTEGRATION_ZOHO_REGION!];
    if (!domain)
      providerFailure(
        'PROVIDER_CONFIGURATION_REQUIRED',
        'Choose a supported Zoho data center before connecting.',
      );
    form.set('client_id', process.env.INTEGRATION_ZOHO_CLIENT_ID!);
    form.set('client_secret', process.env.INTEGRATION_ZOHO_CLIENT_SECRET!);
    return tokenCredentials(
      await this.requestForm(
        new URL(`https://accounts.${domain}/oauth/v2/token`),
        form,
      ),
    );
  }

  async discover(
    provider: ConnectedAccountProvider,
    credentials: OAuthCredentials,
  ): Promise<ConnectedCandidate[]> {
    if (provider === 'INSTAGRAM' || provider === 'FACEBOOK')
      return this.discoverMeta(provider, credentials);
    if (provider === 'LINKEDIN') return this.discoverLinkedIn(credentials);
    if (provider === 'YOUTUBE') return this.discoverYouTube(credentials);
    const region = process.env.INTEGRATION_ZOHO_REGION!;
    return [
      {
        provider,
        kind: 'EMAIL',
        externalAccountId: `ZOHO_CAMPAIGNS_${region}`,
        displayName: 'Zoho Campaigns',
        handle: null,
        profileUrl: null,
        profileMetadataExpiresAt: null,
        credentials: {
          ...credentials,
          providerData: { ...(credentials.providerData ?? {}), region },
        },
        tokenExpiresAt: credentials.expiresAt
          ? new Date(credentials.expiresAt)
          : null,
      },
    ];
  }

  private async discoverMeta(
    provider: 'INSTAGRAM' | 'FACEBOOK',
    userCredentials: OAuthCredentials,
  ): Promise<ConnectedCandidate[]> {
    const version = process.env.INTEGRATION_META_API_VERSION!;
    const pagesUrl = new URL(
      `https://graph.facebook.com/${version}/me/accounts`,
    );
    pagesUrl.searchParams.set(
      'fields',
      'id,name,access_token,link,instagram_business_account{id,username,name,profile_picture_url}',
    );
    pagesUrl.searchParams.set('limit', '100');
    const pages = await this.metaPages(pagesUrl, userCredentials.accessToken);
    const candidates: ConnectedCandidate[] = [];
    for (const pageValue of pages.slice(0, 1000)) {
      const page = record(pageValue);
      const pageId = stringValue(page.id);
      const pageToken = stringValue(page.access_token);
      if (!/^\d+$/.test(pageId) || !pageToken) continue;
      const pageName = text(page.name, 160) ?? 'Facebook Page';
      if (provider === 'FACEBOOK') {
        candidates.push({
          provider,
          kind: 'SOCIAL',
          externalAccountId: pageId,
          displayName: pageName,
          handle: null,
          profileUrl: this.safeFacebookUrl(page.link),
          profileMetadataExpiresAt: null,
          credentials: { accessToken: pageToken },
          tokenExpiresAt: null,
        });
        continue;
      }
      const linkedInstagram = page.instagram_business_account;
      if (!linkedInstagram) continue;
      const instagram = record(linkedInstagram);
      const instagramId = stringValue(instagram.id);
      if (!/^\d+$/.test(instagramId)) continue;
      let profile: Record<string, unknown> = instagram;
      try {
        const profileUrl = new URL(
          `https://graph.facebook.com/${version}/${instagramId}`,
        );
        profileUrl.searchParams.set(
          'fields',
          'id,username,name,profile_picture_url',
        );
        profile = await this.requestJson(profileUrl, pageToken);
      } catch {
        // A linked account may return only its ID; retain the Page's label.
      }
      const handle = text(profile.username, 160);
      candidates.push({
        provider,
        kind: 'SOCIAL',
        externalAccountId: instagramId,
        displayName:
          text(profile.name, 160) ?? (handle ? `@${handle}` : pageName),
        handle,
        profileUrl: handle
          ? `https://www.instagram.com/${encodeURIComponent(handle)}/`
          : null,
        profileMetadataExpiresAt: null,
        credentials: { accessToken: pageToken },
        tokenExpiresAt: null,
      });
    }
    return candidates;
  }

  private async metaPages(
    initialUrl: URL,
    token: string,
    maxPages = 5,
  ): Promise<unknown[]> {
    const values: unknown[] = [];
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const url = new URL(initialUrl);
      if (cursor) url.searchParams.set('after', cursor);
      const response = await this.requestJson(url, token);
      const pageValues = records(response.data);
      values.push(...pageValues);
      if (pageValues.length === 0) break;
      const paging =
        response.paging && typeof response.paging === 'object'
          ? record(response.paging)
          : {};
      const cursors =
        paging.cursors && typeof paging.cursors === 'object'
          ? record(paging.cursors)
          : {};
      const nextCursor = stringValue(cursors.after);
      if (
        typeof paging.next !== 'string' ||
        !paging.next ||
        !nextCursor ||
        seenCursors.has(nextCursor)
      )
        break;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    }
    return values;
  }

  private safeFacebookUrl(value: unknown) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' &&
        ['facebook.com', 'www.facebook.com'].includes(url.hostname)
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }

  private async discoverLinkedIn(credentials: OAuthCredentials) {
    const version = process.env.INTEGRATION_LINKEDIN_API_VERSION!;
    const url = new URL('https://api.linkedin.com/rest/organizationAcls');
    for (const [key, value] of Object.entries({
      q: 'roleAssignee',
      role: 'ADMINISTRATOR',
      state: 'APPROVED',
      count: '100',
      start: '0',
    }))
      url.searchParams.set(key, value);
    const entries = await this.linkedInPages(
      url,
      credentials.accessToken,
      {
        'LinkedIn-Version': version,
        'X-Restli-Protocol-Version': '2.0.0',
      },
      'elements',
    );
    const candidates: ConnectedCandidate[] = [];
    for (const value of entries.slice(0, 1000)) {
      const entry = record(value);
      const organizationUrn = stringValue(entry.organization);
      const id = organizationUrn.match(/^urn:li:organization:(\d+)$/)?.[1];
      if (!id || entry.state !== 'APPROVED' || entry.role !== 'ADMINISTRATOR')
        continue;
      let name = `LinkedIn organization ${id}`;
      let vanity: string | null = null;
      try {
        const organization = await this.requestJson(
          new URL(`https://api.linkedin.com/rest/organizations/${id}`),
          credentials.accessToken,
          {
            'LinkedIn-Version': version,
            'X-Restli-Protocol-Version': '2.0.0',
          },
        );
        name = text(organization.localizedName, 160) ?? name;
        vanity = text(organization.vanityName, 160);
      } catch {
        // Organization IDs remain useful for account navigation if profile
        // fields are unavailable to the application's granted tier.
      }
      candidates.push({
        provider: 'LINKEDIN',
        kind: 'SOCIAL',
        externalAccountId: id,
        displayName: name,
        handle: vanity,
        profileUrl: vanity
          ? `https://www.linkedin.com/company/${encodeURIComponent(vanity)}/`
          : null,
        profileMetadataExpiresAt: new Date(
          Date.now() + 8 * 7 * 24 * 60 * 60 * 1000,
        ),
        credentials: {
          ...credentials,
          providerData: {
            ...(credentials.providerData ?? {}),
            organizationUrn,
          },
        },
        tokenExpiresAt: credentials.expiresAt
          ? new Date(credentials.expiresAt)
          : null,
      });
    }
    return candidates;
  }

  private async linkedInPages(
    initialUrl: URL,
    token: string,
    headers: Record<string, string>,
    collectionField: string,
    maxPages = 10,
  ): Promise<unknown[]> {
    const values: unknown[] = [];
    const seenStarts = new Set<number>();
    let start = Number(initialUrl.searchParams.get('start') ?? 0);
    const count = Number(initialUrl.searchParams.get('count') ?? 100);
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      if (seenStarts.has(start)) break;
      seenStarts.add(start);
      const url = new URL(initialUrl);
      url.searchParams.set('start', String(start));
      const response = await this.requestJson(url, token, headers);
      const pageValues = records(response[collectionField]);
      values.push(...pageValues);
      const paging =
        response.paging && typeof response.paging === 'object'
          ? record(response.paging)
          : {};
      const total =
        typeof paging.total === 'number' && Number.isFinite(paging.total)
          ? paging.total
          : null;
      if (
        pageValues.length === 0 ||
        pageValues.length < count ||
        (total !== null && start + pageValues.length >= total)
      )
        break;
      start += pageValues.length;
    }
    return values;
  }

  private async discoverYouTube(credentials: OAuthCredentials) {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels');
    url.searchParams.set('part', 'snippet,statistics');
    url.searchParams.set('mine', 'true');
    url.searchParams.set('maxResults', '50');
    const values: unknown[] = [];
    const seenTokens = new Set<string>();
    let pageToken: string | null = null;
    for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
      const pageUrl = new URL(url);
      if (pageToken) pageUrl.searchParams.set('pageToken', pageToken);
      const result = await this.requestJson(pageUrl, credentials.accessToken);
      const pageValues = records(result.items);
      values.push(...pageValues);
      const nextToken = stringValue(result.nextPageToken);
      if (!nextToken || seenTokens.has(nextToken)) break;
      seenTokens.add(nextToken);
      pageToken = nextToken;
    }
    return values.slice(0, 500).flatMap((value) => {
      const item = record(value);
      const id = stringValue(item.id);
      const snippet = record(item.snippet);
      const channelId = id.match(/^[A-Za-z0-9_-]{1,80}$/)?.[0];
      if (!channelId) return [];
      const handle = text(snippet.customUrl, 160);
      return [
        {
          provider: 'YOUTUBE' as const,
          kind: 'SOCIAL' as const,
          externalAccountId: channelId,
          displayName: text(snippet.title, 160) ?? 'YouTube channel',
          handle,
          profileUrl: handle
            ? `https://www.youtube.com/${encodeURIComponent(handle)}`
            : `https://www.youtube.com/channel/${channelId}`,
          profileMetadataExpiresAt: null,
          credentials,
          tokenExpiresAt: credentials.expiresAt
            ? new Date(credentials.expiresAt)
            : null,
        },
      ];
    });
  }

  async sync(
    account: {
      provider: ConnectedAccountProvider;
      externalAccountId: string;
      credentialCiphertext?: string | null;
    },
    credentials: OAuthCredentials,
    from: string,
    to: string,
    snapshotDate = reportingDay(),
  ): Promise<ProviderSyncResult> {
    if (account.provider === 'INSTAGRAM')
      return this.syncInstagram(
        account.externalAccountId,
        credentials,
        from,
        to,
        snapshotDate,
      );
    if (account.provider === 'FACEBOOK')
      return this.syncFacebook(
        account.externalAccountId,
        credentials,
        from,
        to,
        snapshotDate,
      );
    if (account.provider === 'LINKEDIN')
      return this.syncLinkedIn(
        account.externalAccountId,
        credentials,
        from,
        to,
      );
    if (account.provider === 'YOUTUBE')
      return this.syncYouTube(account.externalAccountId, credentials, from, to);
    return this.syncZoho(credentials, from, to);
  }

  async syncMetaAccountMetrics(
    account: {
      provider: 'INSTAGRAM' | 'FACEBOOK';
      externalAccountId: string;
    },
    credentials: OAuthCredentials,
    from: string,
    to: string,
  ): Promise<MetricObservation[]> {
    const version = process.env.INTEGRATION_META_API_VERSION!;
    const metrics: MetricObservation[] = [];
    if (account.provider === 'INSTAGRAM') {
      const metricNames: Record<string, string> = {
        views: 'MEDIA_VIEWS',
        reach: 'ACCOUNTS_REACHED',
        total_interactions: 'CONTENT_INTERACTIONS',
      };
      for (let date = from; date <= to; date = this.nextDay(date)) {
        const insightsUrl = new URL(
          `https://graph.facebook.com/${version}/${account.externalAccountId}/insights`,
        );
        insightsUrl.searchParams.set(
          'metric',
          'views,reach,total_interactions',
        );
        insightsUrl.searchParams.set('period', 'day');
        insightsUrl.searchParams.set('metric_type', 'total_value');
        insightsUrl.searchParams.set('since', date);
        insightsUrl.searchParams.set('until', this.nextDay(date));
        const response = await this.requestJson(
          insightsUrl,
          credentials.accessToken,
        );
        for (const value of records(response.data)) {
          const metric = record(value);
          const code = metricNames[stringValue(metric.name)];
          const total = record(metric.total_value).value;
          if (code && total !== undefined && total !== null)
            metrics.push({
              date,
              scope: 'DAILY',
              code,
              sourceMetric: stringValue(metric.name),
              value: metricNumber(total),
            });
        }
      }
      return metrics.filter((metric) => this.inRange(metric.date, from, to));
    }

    const visitsUrl = new URL(
      `https://graph.facebook.com/${version}/${account.externalAccountId}/insights`,
    );
    visitsUrl.searchParams.set('metric', 'page_views_total');
    visitsUrl.searchParams.set('period', 'day');
    visitsUrl.searchParams.set('since', from);
    visitsUrl.searchParams.set('until', this.nextDay(to));
    const pageInsights = await this.requestJson(
      visitsUrl,
      credentials.accessToken,
    );
    for (const item of records(pageInsights.data)) {
      const metric = record(item);
      for (const observation of records(metric.values)) {
        const point = record(observation);
        const date = this.metaObservationDate(
          point.start_time ?? point.end_time,
        );
        if (
          date &&
          this.inRange(date, from, to) &&
          point.value !== undefined &&
          point.value !== null
        )
          metrics.push({
            date,
            scope: 'DAILY',
            code: 'PAGE_VISITS',
            sourceMetric: 'page_views_total',
            value: metricNumber(point.value),
          });
      }
    }
    const organicUrl = new URL(
      `https://graph.facebook.com/${version}/${account.externalAccountId}/insights`,
    );
    organicUrl.searchParams.set('metric', 'page_media_view');
    organicUrl.searchParams.set('period', 'day');
    organicUrl.searchParams.set('since', from);
    organicUrl.searchParams.set('until', this.nextDay(to));
    organicUrl.searchParams.set('breakdown', 'is_from_ads');
    const organicInsights = await this.requestJson(
      organicUrl,
      credentials.accessToken,
    );
    metrics.push(
      ...this.explicitOrganicValues(organicInsights, from, to).map((point) => ({
        ...point,
        code: 'ORGANIC_MEDIA_VIEWS',
        sourceMetric: 'page_media_view:is_from_ads=false',
        scope: 'DAILY' as const,
      })),
    );
    return metrics.filter((metric) => this.inRange(metric.date, from, to));
  }

  async fetchMetaAudienceSnapshot(
    account: {
      provider: 'INSTAGRAM' | 'FACEBOOK';
      externalAccountId: string;
    },
    credentials: OAuthCredentials,
    snapshotDate = reportingDay(),
  ): Promise<MetricObservation | null> {
    const version = process.env.INTEGRATION_META_API_VERSION!;
    const fields =
      account.provider === 'INSTAGRAM'
        ? 'id,username,name,followers_count'
        : 'id,name,followers_count';
    const profileUrl = new URL(
      `https://graph.facebook.com/${version}/${account.externalAccountId}`,
    );
    profileUrl.searchParams.set('fields', fields);
    const profile = await this.requestJson(profileUrl, credentials.accessToken);
    if (
      profile.followers_count === undefined ||
      profile.followers_count === null
    )
      return null;
    return {
      date: validDay(snapshotDate),
      scope: 'SNAPSHOT',
      code: 'AUDIENCE_SIZE',
      sourceMetric: 'followers_count',
      value: metricNumber(profile.followers_count),
    };
  }

  async syncMetaRecentContent(
    account: {
      provider: 'INSTAGRAM' | 'FACEBOOK';
      externalAccountId: string;
    },
    credentials: OAuthCredentials,
    from: string,
    to: string,
  ): Promise<PostObservation[]> {
    validDay(from);
    validDay(to);
    const days =
      Math.floor(
        (Date.parse(`${to}T00:00:00.000Z`) -
          Date.parse(`${from}T00:00:00.000Z`)) /
          86_400_000,
      ) + 1;
    if (days < 1 || days > 30)
      providerFailure(
        'INVALID_POST_SYNC_RANGE',
        'Recent post refresh is limited to 30 calendar days.',
      );
    const version = process.env.INTEGRATION_META_API_VERSION!;
    return account.provider === 'INSTAGRAM'
      ? this.fetchInstagramPosts(
          account.externalAccountId,
          credentials.accessToken,
          version,
          from,
          to,
        )
      : this.fetchFacebookPosts(
          account.externalAccountId,
          credentials.accessToken,
          version,
          from,
          to,
        );
  }

  private async syncInstagram(
    accountId: string,
    credentials: OAuthCredentials,
    from: string,
    to: string,
    snapshotDate: string,
  ): Promise<ProviderSyncResult> {
    const version = process.env.INTEGRATION_META_API_VERSION!;
    const metrics: MetricObservation[] = [];
    const metricNames: Record<string, string> = {
      views: 'MEDIA_VIEWS',
      reach: 'ACCOUNTS_REACHED',
      total_interactions: 'CONTENT_INTERACTIONS',
    };
    // These account metrics require total_value in current Graph versions.
    // Request one calendar day at a time so period totals are never stored
    // as daily observations or duplicated across the selected date range.
    for (let date = from; date <= to; date = this.nextDay(date)) {
      const insightsUrl = new URL(
        `https://graph.facebook.com/${version}/${accountId}/insights`,
      );
      insightsUrl.searchParams.set('metric', 'views,reach,total_interactions');
      insightsUrl.searchParams.set('period', 'day');
      insightsUrl.searchParams.set('metric_type', 'total_value');
      insightsUrl.searchParams.set('since', date);
      insightsUrl.searchParams.set('until', this.nextDay(date));
      const insightResponse = await this.requestJson(
        insightsUrl,
        credentials.accessToken,
      );
      for (const value of records(insightResponse.data)) {
        const metric = record(value);
        const code = metricNames[stringValue(metric.name)];
        const total = record(metric.total_value).value;
        if (code && total !== undefined && total !== null)
          metrics.push({
            date,
            scope: 'DAILY',
            code,
            sourceMetric: stringValue(metric.name),
            value: metricNumber(total),
          });
      }
    }

    const profileUrl = new URL(
      `https://graph.facebook.com/${version}/${accountId}`,
    );
    profileUrl.searchParams.set('fields', 'id,username,name,followers_count');
    const profile = await this.requestJson(profileUrl, credentials.accessToken);
    if (profile.followers_count !== undefined)
      metrics.push({
        date: snapshotDate,
        scope: 'SNAPSHOT',
        code: 'AUDIENCE_SIZE',
        sourceMetric: 'followers_count',
        value: metricNumber(profile.followers_count),
      });

    const posts = await this.fetchInstagramPosts(
      accountId,
      credentials.accessToken,
      version,
      from,
      to,
    );
    return {
      metrics,
      posts,
      emailCampaigns: [],
      caveats: [
        'Instagram account insights are available for up to 90 days. Views count plays or displays; reach counts unique accounts.',
        'Follower change is calculated only between audience-size snapshots collected by this app; no baseline exists before the first sync.',
        'Top-content ranking is based on up to 20 eligible media items synced for the selected period.',
      ],
    };
  }

  private async fetchInstagramPosts(
    accountId: string,
    token: string,
    version: string,
    from: string,
    to: string,
  ): Promise<PostObservation[]> {
    const mediaUrl = new URL(
      `https://graph.facebook.com/${version}/${accountId}/media`,
    );
    mediaUrl.searchParams.set(
      'fields',
      'id,caption,media_type,permalink,timestamp',
    );
    mediaUrl.searchParams.set('limit', '100');
    const mediaRecords = await this.metaPages(mediaUrl, token);
    const posts: PostObservation[] = [];
    for (const value of mediaRecords.slice(0, 500)) {
      if (posts.length >= 20) break;
      const media = record(value);
      const id = stringValue(media.id);
      if (!/^\d+$/.test(id)) continue;
      const publishedAt = providerDate(media.timestamp);
      const publishedDay = publishedAt?.slice(0, 10);
      if (!publishedDay || !this.inRange(publishedDay, from, to)) continue;
      const insightsUrl = new URL(
        `https://graph.facebook.com/${version}/${id}/insights`,
      );
      insightsUrl.searchParams.set('metric', 'views,reach,total_interactions');
      let metricValues: Record<string, number> = {};
      try {
        const response = await this.requestJson(insightsUrl, token);
        const map: Record<string, string> = {
          views: 'VIEWS',
          reach: 'REACH',
          total_interactions: 'INTERACTIONS',
        };
        for (const item of records(response.data)) {
          const metric = record(item);
          const target = map[stringValue(metric.name)];
          const point = records(metric.values)[0];
          if (!target || !point) continue;
          const pointRecord = record(point);
          if (pointRecord.value !== undefined)
            metricValues[target] = metricNumber(pointRecord.value);
        }
      } catch {
        // Keep the post in the account list, but omit metrics that the
        // provider does not expose for this media type.
      }
      posts.push({
        externalPostId: id,
        title: text(media.caption, 500),
        postType: text(media.media_type, 80),
        permalink: this.safeExternalUrl(media.permalink, [
          'instagram.com',
          'www.instagram.com',
        ]),
        publishedAt,
        metricValues,
        dataScope: 'LIFETIME',
      });
    }
    return posts;
  }

  private async syncFacebook(
    pageId: string,
    credentials: OAuthCredentials,
    from: string,
    to: string,
    snapshotDate: string,
  ): Promise<ProviderSyncResult> {
    const version = process.env.INTEGRATION_META_API_VERSION!;
    const metrics: MetricObservation[] = [];
    const profileUrl = new URL(
      `https://graph.facebook.com/${version}/${pageId}`,
    );
    profileUrl.searchParams.set('fields', 'id,name,followers_count');
    const profile = await this.requestJson(profileUrl, credentials.accessToken);
    if (profile.followers_count !== undefined)
      metrics.push({
        date: snapshotDate,
        scope: 'SNAPSHOT',
        code: 'AUDIENCE_SIZE',
        sourceMetric: 'followers_count',
        value: metricNumber(profile.followers_count),
      });

    const visitsUrl = new URL(
      `https://graph.facebook.com/${version}/${pageId}/insights`,
    );
    visitsUrl.searchParams.set('metric', 'page_views_total');
    visitsUrl.searchParams.set('period', 'day');
    visitsUrl.searchParams.set('since', from);
    visitsUrl.searchParams.set('until', this.nextDay(to));
    const pageInsights = await this.requestJson(
      visitsUrl,
      credentials.accessToken,
    );
    for (const item of records(pageInsights.data)) {
      const metric = record(item);
      for (const observation of records(metric.values)) {
        const point = record(observation);
        const date = this.metaObservationDate(
          point.start_time ?? point.end_time,
        );
        if (date && this.inRange(date, from, to) && point.value !== undefined)
          metrics.push({
            date,
            scope: 'DAILY',
            code: 'PAGE_VISITS',
            sourceMetric: 'page_views_total',
            value: metricNumber(point.value),
          });
      }
    }

    const organicUrl = new URL(
      `https://graph.facebook.com/${version}/${pageId}/insights`,
    );
    organicUrl.searchParams.set('metric', 'page_media_view');
    organicUrl.searchParams.set('period', 'day');
    organicUrl.searchParams.set('since', from);
    organicUrl.searchParams.set('until', this.nextDay(to));
    organicUrl.searchParams.set('breakdown', 'is_from_ads');
    const organicInsights = await this.requestJson(
      organicUrl,
      credentials.accessToken,
    );
    const organic = this.explicitOrganicValues(organicInsights, from, to);
    metrics.push(
      ...organic.map((point) => ({
        ...point,
        code: 'ORGANIC_MEDIA_VIEWS',
        sourceMetric: 'page_media_view:is_from_ads=false',
        scope: 'DAILY' as const,
      })),
    );

    const posts = await this.fetchFacebookPosts(
      pageId,
      credentials.accessToken,
      version,
      from,
      to,
    );
    return {
      metrics,
      posts,
      emailCampaigns: [],
      caveats: [
        'Facebook page visits are visits to the Page profile. Media views are included only when Meta explicitly marks them as unpaid; paid and mixed totals are excluded.',
        'Audience size is a follower-count snapshot. Change is shown only after at least two app syncs.',
        'Top-content ranking is based on up to 20 eligible published posts synced for the selected period.',
      ],
    };
  }

  private async fetchFacebookPosts(
    pageId: string,
    token: string,
    version: string,
    from: string,
    to: string,
  ): Promise<PostObservation[]> {
    const url = new URL(
      `https://graph.facebook.com/${version}/${pageId}/published_posts`,
    );
    url.searchParams.set('fields', 'id,message,permalink_url,created_time');
    url.searchParams.set('limit', '100');
    const postRecords = await this.metaPages(url, token);
    const posts: PostObservation[] = [];
    for (const value of postRecords.slice(0, 500)) {
      if (posts.length >= 20) break;
      const post = record(value);
      const id = stringValue(post.id);
      const publishedAt = providerDate(post.created_time);
      const publishedDay = publishedAt?.slice(0, 10);
      if (!id || !publishedDay || !this.inRange(publishedDay, from, to))
        continue;
      const insightUrl = new URL(
        `https://graph.facebook.com/${version}/${id}/insights`,
      );
      insightUrl.searchParams.set('metric', 'post_media_view');
      insightUrl.searchParams.set('breakdown', 'is_from_ads');
      let views: number | undefined;
      try {
        const insights = await this.requestJson(insightUrl, token);
        const daily = this.explicitOrganicValues(insights, from, to);
        // This is a lifetime post snapshot. The endpoint may omit end_time;
        // the parser only accepts explicit organic values either way.
        const lifetime = this.explicitOrganicValues(insights, from, to, true);
        views = lifetime.at(-1)?.value ?? daily.at(-1)?.value;
      } catch {
        // A post without an insights permission or metric remains listed with
        // no performance value instead of a fabricated zero.
      }
      posts.push({
        externalPostId: id,
        title: text(post.message, 500),
        postType: null,
        permalink: this.safeExternalUrl(post.permalink_url, [
          'facebook.com',
          'www.facebook.com',
        ]),
        publishedAt,
        metricValues: views === undefined ? {} : { ORGANIC_VIEWS: views },
        dataScope: 'LIFETIME',
      });
    }
    return posts;
  }

  private explicitOrganicValues(
    response: Record<string, unknown>,
    from: string,
    to: string,
    allowNoDate = false,
  ) {
    const points: Array<
      Omit<MetricObservation, 'scope' | 'code' | 'sourceMetric'>
    > = [];
    for (const value of records(response.data)) {
      const metric = record(value);
      for (const item of records(metric.values)) {
        const entry = record(item);
        const date = this.metaObservationDate(
          entry.start_time ?? entry.end_time,
        );
        if (!allowNoDate && (!date || !this.inRange(date, from, to))) continue;
        if (allowNoDate && date && !this.inRange(date, from, to)) continue;
        const organic = this.isExplicitOrganic(entry);
        if (!organic) continue;
        const raw = this.breakdownValue(entry);
        if (raw === undefined) continue;
        points.push({ date: date ?? to, value: metricNumber(raw) });
      }
    }
    return points;
  }

  private isExplicitOrganic(value: Record<string, unknown>) {
    // Current Page Insights places the breakdown directly on each value.
    if (
      value.is_from_ads === false ||
      value.is_from_ads === 0 ||
      value.is_from_ads === 'false' ||
      value.is_from_ads === '0'
    )
      return true;
    if (
      value.is_from_ads === true ||
      value.is_from_ads === 1 ||
      value.is_from_ads === 'true' ||
      value.is_from_ads === '1'
    )
      return false;
    const breakdowns =
      value.breakdowns ?? value.breakdown ?? value.dimension_values;
    if (Array.isArray(breakdowns)) {
      for (const item of breakdowns) {
        if (item === false || item === 'false' || item === '0') return true;
        if (item === true || item === 'true' || item === '1') return false;
        if (item && typeof item === 'object') {
          const recordValue = item as Record<string, unknown>;
          if (
            recordValue.is_from_ads === false ||
            recordValue.is_from_ads === 'false'
          )
            return true;
          if (
            recordValue.is_from_ads === true ||
            recordValue.is_from_ads === 'true'
          )
            return false;
        }
      }
    }
    const objectValue = value.value;
    if (
      objectValue &&
      typeof objectValue === 'object' &&
      !Array.isArray(objectValue)
    ) {
      const valueRecord = objectValue as Record<string, unknown>;
      if (
        valueRecord.is_from_ads === false ||
        valueRecord.is_from_ads === 'false'
      )
        return true;
      if (
        valueRecord.is_from_ads === true ||
        valueRecord.is_from_ads === 'true'
      )
        return false;
      if (valueRecord.organic !== undefined) return true;
    }
    return false;
  }

  private breakdownValue(value: Record<string, unknown>) {
    const raw = value.value;
    if (typeof raw === 'number' || typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const valueRecord = raw as Record<string, unknown>;
      if (
        typeof valueRecord.organic === 'number' ||
        typeof valueRecord.organic === 'string'
      )
        return valueRecord.organic;
      if (
        typeof valueRecord.value === 'number' ||
        typeof valueRecord.value === 'string'
      )
        return valueRecord.value;
    }
    return undefined;
  }

  private async syncLinkedIn(
    organizationId: string,
    credentials: OAuthCredentials,
    from: string,
    to: string,
  ): Promise<ProviderSyncResult> {
    const version = process.env.INTEGRATION_LINKEDIN_API_VERSION!;
    const orgUrn =
      credentials.providerData?.organizationUrn ??
      `urn:li:organization:${organizationId}`;
    const headers = {
      'LinkedIn-Version': version,
      'X-Restli-Protocol-Version': '2.0.0',
    };
    const start = Date.parse(`${from}T00:00:00.000Z`);
    const end = Date.parse(`${this.nextDay(to)}T00:00:00.000Z`);
    const pageUrl = new URL(
      'https://api.linkedin.com/rest/organizationPageStatistics',
    );
    pageUrl.searchParams.set('q', 'organization');
    pageUrl.searchParams.set('organization', orgUrn);
    pageUrl.searchParams.set('timeIntervals.timeGranularityType', 'DAY');
    pageUrl.searchParams.set('timeIntervals.timeRange.start', String(start));
    pageUrl.searchParams.set('timeIntervals.timeRange.end', String(end));
    const followersUrl = new URL(
      'https://api.linkedin.com/rest/organizationalEntityFollowerStatistics',
    );
    followersUrl.searchParams.set('q', 'organizationalEntity');
    followersUrl.searchParams.set('organizationalEntity', orgUrn);
    followersUrl.searchParams.set('timeIntervals.timeGranularityType', 'DAY');
    followersUrl.searchParams.set(
      'timeIntervals.timeRange.start',
      String(start),
    );
    followersUrl.searchParams.set('timeIntervals.timeRange.end', String(end));
    const sharesUrl = new URL(
      'https://api.linkedin.com/rest/organizationalEntityShareStatistics',
    );
    sharesUrl.searchParams.set('q', 'organizationalEntity');
    sharesUrl.searchParams.set('organizationalEntity', orgUrn);
    sharesUrl.searchParams.set('timeIntervals.timeGranularityType', 'DAY');
    sharesUrl.searchParams.set('timeIntervals.timeRange.start', String(start));
    sharesUrl.searchParams.set('timeIntervals.timeRange.end', String(end));
    const [pageStats, followerStats, shareStats] = await Promise.all([
      this.requestJson(pageUrl, credentials.accessToken, headers),
      this.requestJson(followersUrl, credentials.accessToken, headers),
      this.requestJson(sharesUrl, credentials.accessToken, headers),
    ]);
    const metrics: MetricObservation[] = [];
    for (const item of records(pageStats.elements)) {
      const entry = record(item);
      const timeRange = record(entry.timeRange);
      const day = dateFromTimestamp(Number(timeRange.start));
      const total = record(entry.totalPageStatistics);
      const views = record(record(total.views).allPageViews);
      if (this.inRange(day, from, to) && views.pageViews !== undefined)
        metrics.push({
          date: day,
          scope: 'DAILY',
          code: 'PAGE_VIEWS',
          sourceMetric: 'allPageViews.pageViews',
          value: metricNumber(views.pageViews),
        });
    }
    for (const item of records(followerStats.elements)) {
      const entry = record(item);
      if (entry.organizationalEntity !== orgUrn) continue;
      const day = dateFromTimestamp(Number(record(entry.timeRange).start));
      const gains = record(entry.followerGains);
      if (!this.inRange(day, from, to)) continue;
      if (gains.organicFollowerGain !== undefined)
        metrics.push({
          date: day,
          scope: 'DAILY',
          code: 'ORGANIC_NEW_FOLLOWERS',
          sourceMetric: 'followerGains.organicFollowerGain',
          value: metricNumber(gains.organicFollowerGain),
        });
    }
    for (const item of records(shareStats.elements)) {
      const entry = record(item);
      if (entry.organizationalEntity !== orgUrn) continue;
      const day = dateFromTimestamp(Number(record(entry.timeRange).start));
      const stats = record(entry.totalShareStatistics);
      if (!this.inRange(day, from, to)) continue;
      for (const [field, code] of [
        ['impressionCount', 'ORGANIC_POST_IMPRESSIONS'],
        ['uniqueImpressionsCount', 'ORGANIC_UNIQUE_IMPRESSIONS'],
        ['clickCount', 'ORGANIC_POST_CLICKS'],
        ['likeCount', 'ORGANIC_POST_LIKES'],
        ['commentCount', 'ORGANIC_POST_COMMENTS'],
        ['shareCount', 'ORGANIC_POST_SHARES'],
      ]) {
        if (stats[field] !== undefined)
          metrics.push({
            date: day,
            scope: 'DAILY',
            code,
            sourceMetric: `totalShareStatistics.${field}`,
            value: metricNumber(stats[field]),
          });
      }
    }
    const posts = await this.fetchLinkedInPosts(
      orgUrn,
      credentials.accessToken,
      headers,
      from,
      to,
    );
    return {
      metrics,
      posts,
      emailCampaigns: [],
      caveats: [
        'LinkedIn share statistics cover organic activity and are available for a rolling 12-month period.',
        'The follower growth chart includes organic follower gains only; LinkedIn paid follower gains are excluded.',
        'LinkedIn reporting data is retained for at most one year under current platform storage requirements.',
        'Top-content ranking is based on up to 20 eligible posts; post metadata is available for only six weeks.',
      ],
    };
  }

  private async fetchLinkedInPosts(
    organizationUrn: string,
    token: string,
    headers: Record<string, string>,
    from: string,
    to: string,
  ): Promise<PostObservation[]> {
    // LinkedIn's organization post metadata is subject to a shorter retention
    // period than reporting data. Don't retrieve or persist posts older than
    // six weeks, even when the selected analytics range is wider.
    const oldestAllowed = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const postFrom = from > oldestAllowed ? from : oldestAllowed;
    if (postFrom > to) return [];
    const postsUrl = new URL('https://api.linkedin.com/rest/posts');
    postsUrl.searchParams.set('q', 'author');
    postsUrl.searchParams.set('author', organizationUrn);
    postsUrl.searchParams.set('count', '100');
    postsUrl.searchParams.set('sortBy', 'CREATED');
    const postRecords = await this.linkedInPages(
      postsUrl,
      token,
      headers,
      'elements',
    );
    const candidates = postRecords
      .slice(0, 1000)
      .flatMap((value) => {
        const post = record(value);
        const urn = stringValue(post.id);
        if (!/^urn:li:(?:share|ugcPost):[A-Za-z0-9_-]{1,100}$/.test(urn))
          return [];
        const rawTimestamp = post.publishedAt ?? post.createdAt;
        const parsedTimestamp =
          typeof rawTimestamp === 'number' ? new Date(rawTimestamp) : null;
        const timestamp =
          parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
            ? parsedTimestamp.toISOString()
            : providerDate(rawTimestamp);
        const date = timestamp?.slice(0, 10);
        if (!date || date < postFrom || date > to) return [];
        const content =
          post.content && typeof post.content === 'object'
            ? record(post.content)
            : {};
        const media =
          content.media && typeof content.media === 'object'
            ? record(content.media)
            : {};
        return [
          {
            urn,
            title: text(post.commentary, 500) ?? text(content.title, 500),
            publishedAt: timestamp,
            postType: text(media.category, 80) ?? 'POST',
          },
        ];
      })
      .slice(0, 20);
    if (!candidates.length) return [];

    const shareUrns = candidates.filter((post) =>
      post.urn.startsWith('urn:li:share:'),
    );
    const ugcUrns = candidates.filter((post) =>
      post.urn.startsWith('urn:li:ugcPost:'),
    );
    const requests: Array<Promise<Record<string, unknown>>> = [];
    if (shareUrns.length) {
      const url = new URL(
        'https://api.linkedin.com/rest/organizationalEntityShareStatistics',
      );
      url.searchParams.set('q', 'organizationalEntity');
      url.searchParams.set('organizationalEntity', organizationUrn);
      url.searchParams.set(
        'shares',
        `List(${shareUrns.map((post) => post.urn).join(',')})`,
      );
      requests.push(this.requestJson(url, token, headers));
    }
    if (ugcUrns.length) {
      const url = new URL(
        'https://api.linkedin.com/rest/organizationalEntityShareStatistics',
      );
      url.searchParams.set('q', 'organizationalEntity');
      url.searchParams.set('organizationalEntity', organizationUrn);
      ugcUrns.forEach((post, index) =>
        url.searchParams.set(`ugcPosts[${index}]`, post.urn),
      );
      requests.push(this.requestJson(url, token, headers));
    }
    const statistics = (await Promise.all(requests)).flatMap((result) =>
      records(result.elements),
    );
    const byUrn = new Map<string, Record<string, number>>();
    for (const value of statistics) {
      const item = record(value);
      const urn = stringValue(item.share ?? item.ugcPost);
      const stats = record(item.totalShareStatistics);
      const metricValues: Record<string, number> = {};
      for (const [source, target] of [
        ['impressionCount', 'ORGANIC_POST_IMPRESSIONS'],
        ['uniqueImpressionsCount', 'ORGANIC_UNIQUE_IMPRESSIONS'],
        ['clickCount', 'ORGANIC_POST_CLICKS'],
        ['likeCount', 'ORGANIC_POST_LIKES'],
        ['commentCount', 'ORGANIC_POST_COMMENTS'],
        ['shareCount', 'ORGANIC_POST_SHARES'],
      ]) {
        const value = stats[source];
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
          metricValues[target] = metricNumber(value);
      }
      if (urn) byUrn.set(urn, metricValues);
    }
    return candidates.map((post) => ({
      externalPostId: post.urn,
      title: post.title,
      postType: post.postType,
      permalink: `https://www.linkedin.com/feed/update/${encodeURIComponent(post.urn)}/`,
      publishedAt: post.publishedAt,
      metricValues: byUrn.get(post.urn) ?? {},
      dataScope: 'LIFETIME',
    }));
  }

  private async syncYouTube(
    channelId: string,
    credentials: OAuthCredentials,
    from: string,
    to: string,
  ): Promise<ProviderSyncResult> {
    const queryUrl = new URL(
      'https://youtubeanalytics.googleapis.com/v2/reports',
    );
    for (const [key, value] of Object.entries({
      ids: `channel==${channelId}`,
      startDate: from,
      endDate: to,
      dimensions: 'day',
      metrics:
        'views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,comments,shares',
      sort: 'day',
    }))
      queryUrl.searchParams.set(key, value);
    const report = await this.requestJson(queryUrl, credentials.accessToken);
    const headers = records(report.columnHeaders).map((value) =>
      stringValue(record(value).name),
    );
    const rows = records(report.rows ?? []);
    const metrics: MetricObservation[] = [];
    const map: Record<string, string> = {
      views: 'VIEWS',
      estimatedMinutesWatched: 'WATCH_TIME_MINUTES',
      subscribersGained: 'SUBSCRIBERS_GAINED',
      subscribersLost: 'SUBSCRIBERS_LOST',
      likes: 'LIKES',
      comments: 'COMMENTS',
      shares: 'SHARES',
    };
    for (const rowValue of rows) {
      const row = records(rowValue);
      const date = validDay(String(row[headers.indexOf('day')]));
      for (const [source, code] of Object.entries(map)) {
        const index = headers.indexOf(source);
        if (index < 0 || row[index] === null || row[index] === undefined)
          continue;
        metrics.push({
          date,
          scope: 'DAILY',
          code,
          sourceMetric: source,
          value: metricNumber(row[index]),
        });
      }
    }
    const channelUrl = new URL(
      'https://www.googleapis.com/youtube/v3/channels',
    );
    channelUrl.searchParams.set('part', 'statistics');
    channelUrl.searchParams.set('id', channelId);
    const channel = await this.requestJson(channelUrl, credentials.accessToken);
    const channelStats = record(records(channel.items)[0]).statistics;
    if (channelStats) {
      const subscribers = record(channelStats).subscriberCount;
      if (subscribers !== undefined && subscribers !== null)
        metrics.push({
          date: to,
          scope: 'SNAPSHOT',
          code: 'AUDIENCE_SIZE',
          sourceMetric: 'statistics.subscriberCount',
          value: metricNumber(subscribers),
        });
    }
    const videos = await this.fetchYouTubeVideos(
      channelId,
      credentials.accessToken,
      from,
      to,
    );
    return {
      metrics,
      posts: videos,
      emailCampaigns: [],
      caveats: [
        'YouTube Analytics reports can omit the newest days while provider metrics finish processing.',
        'Subscriber totals may be hidden or rounded by YouTube. Views and watch time are reported separately.',
        'Video ranking shows up to 10 results returned by YouTube Analytics for the selected period.',
      ],
    };
  }

  private async fetchYouTubeVideos(
    channelId: string,
    token: string,
    from: string,
    to: string,
  ): Promise<PostObservation[]> {
    const url = new URL('https://youtubeanalytics.googleapis.com/v2/reports');
    for (const [key, value] of Object.entries({
      ids: `channel==${channelId}`,
      startDate: from,
      endDate: to,
      dimensions: 'video',
      metrics: 'views,estimatedMinutesWatched,likes,comments,shares',
      sort: '-views',
      maxResults: '10',
    }))
      url.searchParams.set(key, value);
    const report = await this.requestJson(url, token);
    const headers = records(report.columnHeaders).map((value) =>
      stringValue(record(value).name),
    );
    const rows = records(report.rows ?? []).slice(0, 10);
    const ids = rows
      .map((row) => String(records(row)[headers.indexOf('video')]))
      .filter((id) => /^[A-Za-z0-9_-]{6,80}$/.test(id));
    if (!ids.length) return [];
    const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    detailsUrl.searchParams.set('part', 'snippet');
    detailsUrl.searchParams.set('id', ids.join(','));
    const details = await this.requestJson(detailsUrl, token);
    const byId = new Map(
      records(details.items).map((value) => {
        const item = record(value);
        return [stringValue(item.id), record(item.snippet)];
      }),
    );
    return rows.flatMap((value) => {
      const row = records(value);
      const id = String(row[headers.indexOf('video')]);
      if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return [];
      const snippet = byId.get(id);
      const metricValues: Record<string, number> = {};
      for (const [source, target] of [
        ['views', 'VIEWS'],
        ['estimatedMinutesWatched', 'WATCH_TIME_MINUTES'],
        ['likes', 'LIKES'],
        ['comments', 'COMMENTS'],
        ['shares', 'SHARES'],
      ]) {
        const index = headers.indexOf(source);
        if (index >= 0 && row[index] !== null && row[index] !== undefined)
          metricValues[target] = metricNumber(row[index]);
      }
      const publishedAt = providerDate(snippet?.publishedAt);
      return [
        {
          externalPostId: id,
          title: text(snippet?.title, 500),
          postType: 'VIDEO',
          permalink: `https://www.youtube.com/watch?v=${id}`,
          publishedAt,
          metricValues,
          dataScope: 'DATE_RANGE' as const,
        },
      ];
    });
  }

  private async syncZoho(
    credentials: OAuthCredentials,
    from: string,
    to: string,
  ): Promise<ProviderSyncResult> {
    const region =
      credentials.providerData?.region ?? process.env.INTEGRATION_ZOHO_REGION!;
    const domain = zohoDomains[region];
    if (!domain)
      providerFailure(
        'PROVIDER_CONFIGURATION_REQUIRED',
        'Choose a supported Zoho data center before syncing.',
      );
    const campaignRecords = await this.fetchZohoCampaigns(
      domain,
      credentials.accessToken,
    );
    const emailCampaigns: EmailCampaignObservation[] = [];
    const eligibleCampaigns = campaignRecords.filter((item) => {
      const campaign = record(item);
      const sentAt = providerDate(campaign.sent_time ?? campaign.sentAt);
      const sentDay = sentAt?.slice(0, 10);
      return Boolean(sentDay && sentDay >= from && sentDay <= to);
    });
    for (const item of eligibleCampaigns.slice(0, 400)) {
      const campaign = record(item);
      const key = stringValue(campaign.campaign_key ?? campaign.campaignkey);
      if (!/^[A-Za-z0-9_-]{1,180}$/.test(key)) continue;
      const reportUrl = new URL(
        `https://campaigns.${domain}/api/v1.1/campaignreports`,
      );
      reportUrl.searchParams.set('resfmt', 'JSON');
      reportUrl.searchParams.set('campaignkey', key);
      const response = await this.requestJson(
        reportUrl,
        credentials.accessToken,
        {},
        'ZOHO',
      );
      if (response.status !== 'success') {
        const code = stringValue(response.code);
        if (code === '6001')
          providerFailure(
            'PROVIDER_UNAVAILABLE',
            'Zoho could not prepare this campaign report. Retry the sync later.',
          );
        if (code === '6601')
          providerFailure(
            'PROVIDER_ACCESS_DENIED',
            'Zoho denied access to this campaign report. Check the Campaigns read permission.',
          );
        providerFailure(
          'PROVIDER_REQUEST_FAILED',
          'Zoho did not return a campaign report. Retry the sync later.',
        );
      }
      const report = record(records(response['campaign-reports'])[0]);
      const metricValues: Record<string, number> = {};
      for (const [source, target] of [
        ['emails_sent_count', 'SENT'],
        ['delivered_count', 'DELIVERED'],
        ['opens_count', 'OPENS'],
        ['unique_clicks_count', 'UNIQUE_CLICKS'],
        ['open_percent', 'OPEN_RATE'],
        ['unique_clicked_percent', 'UNIQUE_CLICK_RATE'],
        ['bounces_count', 'BOUNCES'],
        ['unsub_count', 'UNSUBSCRIBES'],
      ]) {
        if (report[source] !== null && report[source] !== undefined)
          metricValues[target] = metricNumber(report[source]);
      }
      emailCampaigns.push({
        externalCampaignId: key,
        campaignName:
          text(campaign.campaign_name ?? report.campaign_name, 300) ??
          'Email campaign',
        sentAt: providerDate(campaign.sent_time ?? report.sent_time),
        metricValues,
      });
    }
    return {
      metrics: [],
      posts: [],
      emailCampaigns,
      caveats: [
        'Zoho figures are cumulative campaign totals as last reported by Zoho. They are not daily observations and are kept outside social-account analytics.',
        'This sync selects sent campaigns by send date and fetches at most 400 campaign reports per run to stay within Zoho’s API quota.',
        ...(campaignRecords.length >= 400
          ? [
              'The recent campaign scan reached its 400-campaign safety limit. Older matching campaigns may not be included in this sync.',
            ]
          : []),
      ],
    };
  }

  private async fetchZohoCampaigns(domain: string, token: string) {
    const pageSize = 100;
    const maxPages = 4;
    const campaigns: unknown[] = [];
    const campaignKeys = new Set<string>();
    let fromIndex = 1;
    for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
      const listUrl = new URL(
        `https://campaigns.${domain}/api/v1.1/recentcampaigns`,
      );
      listUrl.searchParams.set('resfmt', 'JSON');
      listUrl.searchParams.set('status', 'sent');
      listUrl.searchParams.set('sort', 'desc');
      listUrl.searchParams.set('fromindex', String(fromIndex));
      listUrl.searchParams.set('range', String(pageSize));
      const result = await this.requestJson(listUrl, token, {}, 'ZOHO');
      if (result.status !== 'success') {
        const code = stringValue(result.code);
        if (code === '6101') return campaigns;
        if (code === '6601')
          providerFailure(
            'PROVIDER_ACCESS_DENIED',
            'Zoho denied access to sent campaigns. Check the Campaigns read permission.',
          );
        providerFailure(
          'PROVIDER_REQUEST_FAILED',
          'Zoho did not return sent campaigns. Retry the sync later.',
        );
      }
      const page = this.zohoCampaignList(result);
      for (const item of page) {
        const campaign = record(item);
        const key = stringValue(campaign.campaign_key ?? campaign.campaignkey);
        if (!key || campaignKeys.has(key)) continue;
        campaignKeys.add(key);
        campaigns.push(item);
      }
      if (page.length < pageSize) break;
      fromIndex += page.length;
    }
    return campaigns;
  }

  async refreshCredentials(
    provider: ConnectedAccountProvider,
    credentials: OAuthCredentials,
  ): Promise<OAuthCredentials> {
    if (!credentials.refreshToken)
      providerFailure(
        'REAUTHENTICATION_REQUIRED',
        'Reconnect this account to continue syncing.',
      );
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
    });
    if (provider === 'LINKEDIN') {
      form.set('client_id', process.env.INTEGRATION_LINKEDIN_CLIENT_ID!);
      form.set(
        'client_secret',
        process.env.INTEGRATION_LINKEDIN_CLIENT_SECRET!,
      );
      const refreshed = tokenCredentials(
        await this.requestForm(
          new URL('https://www.linkedin.com/oauth/v2/accessToken'),
          form,
        ),
      );
      return {
        ...credentials,
        ...refreshed,
        refreshToken: credentials.refreshToken,
      };
    }
    if (provider === 'YOUTUBE') {
      form.set('client_id', process.env.INTEGRATION_GOOGLE_CLIENT_ID!);
      form.set('client_secret', process.env.INTEGRATION_GOOGLE_CLIENT_SECRET!);
      const refreshed = tokenCredentials(
        await this.requestForm(
          new URL('https://oauth2.googleapis.com/token'),
          form,
        ),
      );
      return {
        ...credentials,
        ...refreshed,
        refreshToken: credentials.refreshToken,
      };
    }
    if (provider === 'ZOHO_CAMPAIGNS') {
      const region =
        credentials.providerData?.region ??
        process.env.INTEGRATION_ZOHO_REGION!;
      const domain = zohoDomains[region];
      if (!domain)
        providerFailure(
          'PROVIDER_CONFIGURATION_REQUIRED',
          'Choose a supported Zoho data center before syncing.',
        );
      form.set('client_id', process.env.INTEGRATION_ZOHO_CLIENT_ID!);
      form.set('client_secret', process.env.INTEGRATION_ZOHO_CLIENT_SECRET!);
      const refreshed = tokenCredentials(
        await this.requestForm(
          new URL(`https://accounts.${domain}/oauth/v2/token`),
          form,
        ),
      );
      return {
        ...credentials,
        ...refreshed,
        refreshToken: credentials.refreshToken,
      };
    }
    return credentials;
  }

  async revokeCredentials(
    provider: ConnectedAccountProvider,
    credentials: OAuthCredentials,
  ): Promise<Exclude<ProviderAccessRevocation, 'still_in_use'>> {
    if (provider === 'YOUTUBE') {
      return this.postRevocation(
        new URL('https://oauth2.googleapis.com/revoke'),
        new URLSearchParams({
          token: credentials.refreshToken ?? credentials.accessToken,
        }),
      );
    }

    if (provider === 'ZOHO_CAMPAIGNS') {
      const region =
        credentials.providerData?.region ??
        process.env.INTEGRATION_ZOHO_REGION!;
      const domain = zohoDomains[region];
      const clientId = process.env.INTEGRATION_ZOHO_CLIENT_ID?.trim();
      const clientSecret = process.env.INTEGRATION_ZOHO_CLIENT_SECRET?.trim();
      if (!domain || !clientId || !clientSecret) return 'failed';

      const body = new URLSearchParams({
        token: credentials.refreshToken ?? credentials.accessToken,
        ...(!credentials.refreshToken ? { token_type: 'access_token' } : {}),
      });
      return this.postRevocation(
        new URL(`https://accounts.${domain}/oauth/v2/revoke/token`),
        body,
        {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      );
    }

    // Meta connections store Page access tokens, not the user token required to
    // revoke the app grant. LinkedIn currently documents member-side revocation.
    return 'not_supported';
  }

  private async postRevocation(
    url: URL,
    body: URLSearchParams,
    extraHeaders: Record<string, string> = {},
  ): Promise<'revoked' | 'already_inactive' | 'failed'> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          ...extraHeaders,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      if (response.ok) {
        await response.body?.cancel();
        return 'revoked';
      }

      let errorCode: unknown;
      try {
        const payload = (await response.json()) as Record<string, unknown>;
        errorCode = payload.error;
      } catch {
        await response.body?.cancel();
      }
      return errorCode === 'invalid_token' ? 'already_inactive' : 'failed';
    } catch {
      return 'failed';
    }
  }

  private zohoCampaignList(result: Record<string, unknown>) {
    const content =
      result['recent-campaigns'] ??
      result.recent_campaigns ??
      result.recentcampaigns ??
      result.campaigns ??
      result.data;
    if (Array.isArray(content)) return content;
    if (content && typeof content === 'object') {
      const nested = record(content).campaigns ?? record(content).campaign;
      if (Array.isArray(nested)) return nested;
    }
    return [];
  }

  private async requestForm(url: URL, body: URLSearchParams) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: 'error',
      });
      return await this.readJson(response);
    } catch (error) {
      if (error instanceof AccountProviderFailure) throw error;
      providerFailure(
        'TOKEN_EXCHANGE_FAILED',
        'The provider authorization could not be completed. Check app credentials and callback URL.',
      );
    }
  }

  private async requestJson(
    url: URL,
    token?: string,
    extraHeaders: Record<string, string> = {},
    scheme: 'BEARER' | 'ZOHO' = 'BEARER',
  ) {
    if (
      !/^https:\/\/(graph\.facebook\.com|api\.linkedin\.com|www\.googleapis\.com|youtubeanalytics\.googleapis\.com|campaigns\.zoho\.(com|eu|in|com\.au|jp|com\.cn))$/.test(
        url.origin,
      )
    )
      providerFailure(
        'PROVIDER_ORIGIN_BLOCKED',
        'The provider request origin is not allowed.',
      );
    try {
      const headers: Record<string, string> = { ...extraHeaders };
      if (token)
        headers.Authorization = `${scheme === 'ZOHO' ? 'Zoho-oauthtoken' : 'Bearer'} ${token}`;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let response: Response;
        try {
          response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(this.timeoutMs),
            redirect: 'error',
          });
        } catch (error) {
          if (error instanceof AccountProviderFailure) throw error;
          if (attempt === 2) throw error;
          await this.wait(200 * (attempt + 1));
          continue;
        }

        const retryable =
          response.status === 408 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status === 500 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504;
        if (retryable && attempt < 2) {
          const delay = this.retryDelay(
            response.headers.get('retry-after'),
            attempt,
          );
          if (delay !== null) {
            await response.body?.cancel();
            await this.wait(delay);
            continue;
          }
        }
        return await this.readJson(response);
      }
      providerFailure(
        'PROVIDER_UNAVAILABLE',
        'The provider could not be reached. Retry later or reconnect the account.',
      );
    } catch (error) {
      if (error instanceof AccountProviderFailure) throw error;
      providerFailure(
        'PROVIDER_UNAVAILABLE',
        'The provider could not be reached. Retry later or reconnect the account.',
      );
    }
  }

  private retryDelay(retryAfter: string | null, attempt: number) {
    if (!retryAfter) return 200 * (attempt + 1);
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    if (!Number.isFinite(delay) || delay < 0) return 200 * (attempt + 1);
    // A sync request will not hold a worker for long provider backoffs. Return
    // the provider's 429 so the scheduler can retry on a later run instead.
    return delay <= 1000 ? delay : null;
  }

  private retryAfterMilliseconds(retryAfter: string | null) {
    if (!retryAfter) return undefined;
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    return Number.isFinite(delay) && delay > 0 ? delay : undefined;
  }

  private wait(milliseconds: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }

  private async readJson(response: Response): Promise<Record<string, unknown>> {
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      await response.body?.cancel();
      if (response.status === 401)
        providerFailure(
          'TOKEN_EXPIRED',
          'Reconnect the account and try again.',
        );
      if (response.status === 403)
        providerFailure(
          'PROVIDER_ACCESS_DENIED',
          'The provider denied access. Check permissions and account roles.',
        );
      if (response.status === 429)
        providerFailure(
          'PROVIDER_RATE_LIMITED',
          'The provider rate limit was reached. Retry later.',
          this.retryAfterMilliseconds(retryAfter),
        );
      if ([408, 425, 500, 502, 503, 504].includes(response.status))
        providerFailure(
          'PROVIDER_UNAVAILABLE',
          'The provider could not complete the request. Retry later.',
          this.retryAfterMilliseconds(retryAfter),
        );
      providerFailure(
        'PROVIDER_REQUEST_FAILED',
        'The provider request failed. Check the provider app setup and permissions.',
      );
    }
    const reader = response.body?.getReader();
    if (!reader)
      providerFailure(
        'INVALID_PROVIDER_RESPONSE',
        'The provider returned no response body.',
      );
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        providerFailure(
          'PROVIDER_RESPONSE_TOO_LARGE',
          'The provider response was too large.',
        );
      }
      chunks.push(value);
    }
    try {
      return record(
        JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
      );
    } catch (error) {
      if (error instanceof AccountProviderFailure) throw error;
      providerFailure(
        'INVALID_PROVIDER_RESPONSE',
        'The provider returned invalid JSON.',
      );
    }
  }

  private metaObservationDate(value: unknown): string | null {
    if (typeof value !== 'string' || !value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toISOString().slice(0, 10);
  }

  private inRange(date: string, from: string, to: string) {
    return date >= from && date <= to;
  }

  private nextDay(day: string) {
    const value = new Date(`${validDay(day)}T00:00:00.000Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
  }

  private safeExternalUrl(value: unknown, domains: string[]) {
    if (typeof value !== 'string') return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && domains.includes(url.hostname)
        ? url.toString()
        : null;
    } catch {
      return null;
    }
  }
}
