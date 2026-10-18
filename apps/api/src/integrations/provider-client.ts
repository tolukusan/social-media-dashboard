import { Injectable } from '@nestjs/common';
import {
  IntegrationFailure,
  configuration,
  day,
  fail,
  list,
  numeric,
  object,
  providers,
  zohoHosts,
} from './integration-contract.js';
import type {
  ProviderResult,
  SourceConnection,
  DailyObservation,
} from './integration-contract.js';

// No user-supplied URLs or pagination links are fetched. Provider bodies/errors never reach logs.
@Injectable()
export class ProviderClient {
  async request(
    url: URL,
    token: string,
    extraHeaders: Record<string, string> = {},
    zoho = false,
  ): Promise<Record<string, unknown>> {
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `${zoho ? 'Zoho-oauthtoken' : 'Bearer'} ${token}`,
          ...extraHeaders,
        },
        signal: AbortSignal.timeout(8000),
        redirect: 'error',
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 401)
          fail('TOKEN_EXPIRED', 'Reconnect the provider account and retry.');
        if (response.status === 403)
          fail(
            'PROVIDER_ACCESS_DENIED',
            'The provider denied access. Check account permissions.',
          );
        if (response.status === 429)
          fail(
            'PROVIDER_RATE_LIMITED',
            'The provider rate limit was reached. Retry later.',
          );
        fail(
          'PROVIDER_REQUEST_FAILED',
          'The provider request failed. Check provider configuration.',
        );
      }
      const reader = response.body?.getReader();
      if (!reader)
        fail(
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
          fail('PROVIDER_RESPONSE_TOO_LARGE', 'Narrow the sync date range.');
        }
        chunks.push(value);
      }
      return object(
        JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,
      );
    } catch (error) {
      if (error instanceof IntegrationFailure) throw error;
      fail(
        'PROVIDER_UNAVAILABLE',
        'The provider could not be reached or returned invalid JSON. Retry later.',
      );
    }
  }

  async fetchCampaign(
    connection: SourceConnection,
    campaignId: string,
    from: string,
    to: string,
  ): Promise<ProviderResult> {
    if (!(providers as readonly string[]).includes(connection.provider))
      fail(
        'UNSUPPORTED_PROVIDER_PRODUCT',
        'Campaign sync is not supported for this connected provider product.',
      );
    const config = configuration(connection);
    if (!config.ready)
      fail(
        config.code!,
        'Configure the server access token and API version before syncing.',
      );
    const token =
      connection.accessToken ?? process.env[connection.credentialReference]!;
    if (connection.provider === 'ZOHO_CAMPAIGNS') {
      const url = new URL(
        `https://${zohoHosts[connection.region]}/api/v1.1/campaignreports`,
      );
      url.searchParams.set('resfmt', 'JSON');
      url.searchParams.set('campaignkey', campaignId);
      const response = await this.request(url, token, {}, true);
      if (response.status !== 'success')
        fail(
          'PROVIDER_REQUEST_FAILED',
          'Zoho did not return a successful campaign report. Check access and campaign key.',
        );
      const report = object(list(response['campaign-reports'])[0]);
      const values: Record<string, number> = {};
      for (const [field, code] of [
        ['emails_sent_count', 'EMAIL_SENT'],
        ['delivered_count', 'EMAIL_DELIVERED'],
        ['opens_count', 'EMAIL_OPENS'],
        ['unique_clicks_count', 'EMAIL_CLICKS'],
        ['bounces_count', 'EMAIL_BOUNCES'],
        ['unsub_count', 'EMAIL_UNSUBSCRIBES'],
      ])
        if (report[field] !== undefined && report[field] !== null)
          values[code] = numeric(report[field]);
      if (!Object.keys(values).length)
        fail(
          'INVALID_PROVIDER_RESPONSE',
          'Zoho returned no supported campaign totals.',
        );
      return {
        observations: [],
        snapshot: {
          externalCampaignId: campaignId,
          scope: 'CUMULATIVE_CAMPAIGN',
          values,
        },
      };
    }
    if (
      !/^\d+$/.test(connection.externalAccountId) ||
      !/^\d+$/.test(campaignId)
    )
      fail(
        'INVALID_EXTERNAL_ID',
        'Advertising account and campaign IDs must contain digits only.',
      );
    if (connection.provider === 'LINKEDIN_ADS') {
      const headers = {
        'LinkedIn-Version': process.env.INTEGRATION_LINKEDIN_API_VERSION!,
        'X-Restli-Protocol-Version': '2.0.0',
      };
      const campaign = await this.request(
        new URL(`https://api.linkedin.com/rest/adCampaigns/${campaignId}`),
        token,
        headers,
      );
      if (
        campaign.account !==
        `urn:li:sponsoredAccount:${connection.externalAccountId}`
      )
        fail(
          'PROVIDER_ACCOUNT_MISMATCH',
          'The campaign does not belong to this advertising account.',
        );
      const account = await this.request(
        new URL(
          `https://api.linkedin.com/rest/adAccounts/${connection.externalAccountId}`,
        ),
        token,
        headers,
      );
      if (account.currency !== connection.currency)
        fail(
          'PROVIDER_CURRENCY_MISMATCH',
          'The provider currency differs from the configured currency.',
        );
      const part = (value: string) => {
        const [year, month, d] = value.split('-').map(Number);
        return `(year:${year},month:${month},day:${d})`;
      };
      const url = new URL('https://api.linkedin.com/rest/adAnalytics');
      for (const [key, value] of Object.entries({
        q: 'analytics',
        pivot: 'CAMPAIGN',
        timeGranularity: 'DAILY',
        dateRange: `(start:${part(from)},end:${part(to)})`,
        campaigns: `List(urn:li:sponsoredCampaign:${campaignId})`,
        fields: 'dateRange,pivotValues,impressions,clicks,costInLocalCurrency',
      }))
        url.searchParams.set(key, value);
      const result = await this.request(url, token, headers);
      const rows = list(result.elements);
      if (rows.length > 31)
        fail(
          'INVALID_PROVIDER_RESPONSE',
          'The provider returned more than one daily observation per day.',
        );
      return {
        observations: rows.map((value) => {
          const row = object(value);
          const range = object(row.dateRange);
          const date = (v: unknown) => {
            const d = object(v);
            return day(
              `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`,
            );
          };
          const recordDate = date(range.start);
          if (
            recordDate !== date(range.end) ||
            list(row.pivotValues).length !== 1 ||
            (row.pivotValues instanceof Array &&
              row.pivotValues[0] !== `urn:li:sponsoredCampaign:${campaignId}`)
          )
            fail(
              'PROVIDER_SCOPE_MISMATCH',
              'The provider response does not match the mapped daily campaign scope.',
            );
          const values: Record<string, number> = {};
          for (const [field, code] of [
            ['impressions', 'ADS_IMPRESSIONS'],
            ['clicks', 'ADS_CLICKS'],
            ['costInLocalCurrency', 'ADS_SPEND'],
          ])
            if (row[field] !== undefined && row[field] !== null)
              values[code] = numeric(
                row[field],
                field !== 'costInLocalCurrency',
              );
          return { date: recordDate, values };
        }),
      };
    }
    const accountUrl = new URL(
      `https://graph.facebook.com/${process.env.INTEGRATION_META_API_VERSION}/act_${connection.externalAccountId}`,
    );
    accountUrl.searchParams.set('fields', 'currency,timezone_name');
    const account = await this.request(accountUrl, token);
    if (account.currency !== connection.currency)
      fail(
        'PROVIDER_CURRENCY_MISMATCH',
        'The provider currency differs from the configured currency.',
      );
    if (account.timezone_name !== connection.sourceTimezone)
      fail(
        'PROVIDER_TIMEZONE_MISMATCH',
        'The provider timezone differs from the configured source timezone.',
      );
    const url = new URL(
      `https://graph.facebook.com/${process.env.INTEGRATION_META_API_VERSION}/act_${connection.externalAccountId}/insights`,
    );
    for (const [key, value] of Object.entries({
      level: 'campaign',
      fields:
        'account_id,account_currency,campaign_id,date_start,date_stop,impressions,clicks,spend',
      breakdowns: 'publisher_platform',
      time_increment: '1',
      time_range: JSON.stringify({ since: from, until: to }),
      filtering: JSON.stringify([
        { field: 'campaign.id', operator: 'IN', value: [campaignId] },
      ]),
      limit: '100',
    }))
      url.searchParams.set(key, value);
    const observations: DailyObservation[] = [];
    for (let page = 0; page < 5; page++) {
      const response = await this.request(url, token);
      if (response.error)
        fail(
          'PROVIDER_REQUEST_FAILED',
          'Meta returned an error. Check access and the API version.',
        );
      for (const value of list(response.data)) {
        const row = object(value);
        if (
          row.account_id !== connection.externalAccountId ||
          row.campaign_id !== campaignId
        )
          fail(
            'PROVIDER_SCOPE_MISMATCH',
            'The provider response does not match the mapped campaign scope.',
          );
        if (
          row.publisher_platform !==
          (connection.provider === 'FACEBOOK_ADS' ? 'facebook' : 'instagram')
        )
          continue;
        if (row.account_currency !== connection.currency)
          fail(
            'PROVIDER_CURRENCY_MISMATCH',
            'The provider currency differs from the configured currency.',
          );
        const recordDate = day(row.date_start);
        if (recordDate !== day(row.date_stop))
          fail(
            'PROVIDER_SCOPE_MISMATCH',
            'Meta returned a non-daily observation.',
          );
        const values: Record<string, number> = {};
        for (const [field, code] of [
          ['impressions', 'ADS_IMPRESSIONS'],
          ['clicks', 'ADS_CLICKS'],
          ['spend', 'ADS_SPEND'],
        ])
          if (row[field] !== undefined && row[field] !== null)
            values[code] = numeric(row[field], field !== 'spend');
        observations.push({ date: recordDate, values });
      }
      const paging = response.paging ? object(response.paging) : null;
      if (!paging?.next) return { observations };
      const after = object(paging.cursors).after;
      if (typeof after !== 'string' || after.length > 2000)
        fail(
          'INVALID_PROVIDER_RESPONSE',
          'Meta returned an invalid pagination cursor.',
        );
      url.searchParams.set('after', after);
    }
    fail(
      'PROVIDER_PAGE_LIMIT',
      'Narrow the sync date range; the provider response exceeds the page limit.',
    );
  }
}
