import type { ImportCell } from './import.types.js';

export const IMPORT_DESTINATIONS = [
  'recordDate',
  'campaignName',
  'sourceRecordId',
  'SM_REACH',
  'SM_IMPRESSIONS',
  'SM_ENGAGEMENTS',
  'SM_LINK_CLICKS',
  'SM_FOLLOWERS_GAINED',
  'SM_VIEWS',
  'SM_PROFILE_VISITS',
  'SM_VIEWERS',
  'EMAIL_SENT',
  'EMAIL_DELIVERED',
  'EMAIL_OPENS',
  'EMAIL_CLICKS',
  'EMAIL_UNSUBSCRIBES',
  'EMAIL_CONVERSIONS',
  'EMAIL_BOUNCES',
  'EMAIL_HARD_BOUNCES',
  'EMAIL_SOFT_BOUNCES',
  'EMAIL_SPAM_COMPLAINTS',
  'ADS_IMPRESSIONS',
  'ADS_REACH',
  'ADS_CLICKS',
  'ADS_SPEND',
  'ADS_CONVERSIONS',
  'SEO_ORGANIC_TRAFFIC',
  'SEO_SEARCH_IMPRESSIONS',
  'SEO_SEARCH_CLICKS',
  'SEO_AVG_POSITION',
] as const;

const aliases: Record<string, string> = {
  date: 'recordDate',
  day: 'recordDate',
  'report date': 'recordDate',
  'sent date': 'recordDate',
  'sent time': 'recordDate',
  'campaign name': 'campaignName',
  campaign: 'campaignName',
  'campaign id': 'sourceRecordId',
  'post id': 'sourceRecordId',
  'content interactions': 'SM_ENGAGEMENTS',
  engagements: 'SM_ENGAGEMENTS',
  'link clicks': 'SM_LINK_CLICKS',
  'facebook link clicks': 'SM_LINK_CLICKS',
  'instagram link clicks': 'SM_LINK_CLICKS',
  clicks: 'SM_LINK_CLICKS',
  follows: 'SM_FOLLOWERS_GAINED',
  'facebook follows': 'SM_FOLLOWERS_GAINED',
  'instagram follows': 'SM_FOLLOWERS_GAINED',
  followers: 'SM_FOLLOWERS_GAINED',
  views: 'SM_VIEWS',
  'facebook views': 'SM_VIEWS',
  'instagram views': 'SM_VIEWS',
  viewers: 'SM_VIEWERS',
  visits: 'SM_PROFILE_VISITS',
  'profile visits': 'SM_PROFILE_VISITS',
  'facebook visits': 'SM_PROFILE_VISITS',
  'instagram profile visits': 'SM_PROFILE_VISITS',
  reach: 'SM_REACH',
  impressions: 'SM_IMPRESSIONS',
  sent: 'EMAIL_SENT',
  delivered: 'EMAIL_DELIVERED',
  opened: 'EMAIL_OPENS',
  opens: 'EMAIL_OPENS',
  clicked: 'EMAIL_CLICKS',
  unsubscribes: 'EMAIL_UNSUBSCRIBES',
  conversions: 'EMAIL_CONVERSIONS',
  bounced: 'EMAIL_BOUNCES',
  bounces: 'EMAIL_BOUNCES',
  'hard bounce': 'EMAIL_HARD_BOUNCES',
  'hard bounces': 'EMAIL_HARD_BOUNCES',
  'soft bounce': 'EMAIL_SOFT_BOUNCES',
  'soft bounces': 'EMAIL_SOFT_BOUNCES',
  'marked as spam': 'EMAIL_SPAM_COMPLAINTS',
  'spam complaints': 'EMAIL_SPAM_COMPLAINTS',
  'search impressions': 'SEO_SEARCH_IMPRESSIONS',
  'search clicks': 'SEO_SEARCH_CLICKS',
  'average search position': 'SEO_AVG_POSITION',
  'avg position': 'SEO_AVG_POSITION',
  spend: 'ADS_SPEND',
};

function key(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function suggestedMapping(columns: string[]) {
  return Object.fromEntries(
    columns
      .map((column) => [column, aliases[key(column)]])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export function detectSource(columns: string[]) {
  const joined = columns.map(key).join(' ');
  if (
    joined.includes('sent') &&
    (joined.includes('opened') || joined.includes('delivered'))
  )
    return { type: 'EMAIL', platform: 'EMAIL' };
  if (joined.includes('content interactions') || joined.includes('facebook'))
    return { type: 'META', platform: 'FACEBOOK_OR_INSTAGRAM' };
  if (joined.includes('post id') || joined.includes('reactions'))
    return { type: 'LINKEDIN', platform: 'LINKEDIN' };
  return { type: 'GENERIC', platform: null };
}

export function isBlank(value: ImportCell | undefined | unknown) {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  );
}
