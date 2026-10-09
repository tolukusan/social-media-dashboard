import 'dotenv/config';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  PrismaClient,
  AggregationStrategy,
  MetricKind,
  MetricUnit,
} from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const channels = [
  ['SOCIAL', 'Social Media Marketing'],
  ['WEBSITE', 'Website / Content Marketing'],
  ['EMAIL', 'Email Marketing'],
  ['SEO', 'Search Engine Optimisation'],
  ['ADVERTISING', 'Online Advertising'],
  ['OTHER', 'Other Digital Marketing Channels'],
] as const;
const platforms = [
  ['SOCIAL', 'FACEBOOK', 'Facebook'],
  ['SOCIAL', 'INSTAGRAM', 'Instagram'],
  ['SOCIAL', 'TIKTOK', 'TikTok'],
  ['WEBSITE', 'COMPANY_WEBSITE', 'Company Website'],
  ['EMAIL', 'EMAIL_GENERIC', 'Email / Generic Email Platform'],
  ['SEO', 'GOOGLE_SEARCH', 'Google Search'],
  ['ADVERTISING', 'GOOGLE_ADS', 'Google Ads'],
  ['ADVERTISING', 'FACEBOOK_ADS', 'Facebook Ads'],
  ['ADVERTISING', 'INSTAGRAM_ADS', 'Instagram Ads'],
  ['ADVERTISING', 'LINKEDIN_ADS', 'LinkedIn Ads'],
  ['EMAIL', 'ZOHO_CAMPAIGNS', 'Zoho Campaigns'],
  ['OTHER', 'OTHER', 'Other Platform'],
] as const;
const metrics: Array<
  [string, string, MetricKind, MetricUnit, AggregationStrategy, string[]]
> = [
  [
    'SM_REACH',
    'Reach',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_IMPRESSIONS',
    'Impressions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_ENGAGEMENTS',
    'Engagements',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_LINK_CLICKS',
    'Link Clicks',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_FOLLOWERS_GAINED',
    'Followers Gained',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_VIEWS',
    'Views',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_PROFILE_VISITS',
    'Profile / Page Visits',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_VIEWERS',
    'Unique Viewers',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SOCIAL'],
  ],
  [
    'SM_ENGAGEMENT_RATE',
    'Engagement Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['SOCIAL'],
  ],
  [
    'SM_CTR',
    'Social Click-Through Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['SOCIAL'],
  ],
  [
    'WEB_USERS',
    'Users',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['WEBSITE'],
  ],
  [
    'WEB_SESSIONS',
    'Sessions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['WEBSITE'],
  ],
  [
    'WEB_PAGE_VIEWS',
    'Page Views',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['WEBSITE'],
  ],
  [
    'WEB_CONVERSIONS',
    'Conversions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['WEBSITE'],
  ],
  [
    'WEB_CONVERSION_RATE',
    'Website Conversion Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['WEBSITE'],
  ],
  [
    'EMAIL_SENT',
    'Emails Sent',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_DELIVERED',
    'Emails Delivered',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_OPENS',
    'Opens',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_CLICKS',
    'Email Clicks',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_UNSUBSCRIBES',
    'Unsubscribes',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_CONVERSIONS',
    'Email Conversions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_BOUNCES',
    'Bounces',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_HARD_BOUNCES',
    'Hard Bounces',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_SOFT_BOUNCES',
    'Soft Bounces',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_SPAM_COMPLAINTS',
    'Spam Complaints',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['EMAIL'],
  ],
  [
    'EMAIL_OPEN_RATE',
    'Open Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['EMAIL'],
  ],
  [
    'EMAIL_CTR',
    'Email Click-Through Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['EMAIL'],
  ],
  [
    'EMAIL_CONVERSION_RATE',
    'Email Conversion Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['EMAIL'],
  ],
  [
    'ADS_IMPRESSIONS',
    'Advertising Impressions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['ADVERTISING'],
  ],
  [
    'ADS_REACH',
    'Advertising Reach',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['ADVERTISING'],
  ],
  [
    'ADS_CLICKS',
    'Advertising Clicks',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['ADVERTISING'],
  ],
  [
    'ADS_SPEND',
    'Advertising Spend',
    MetricKind.RAW,
    MetricUnit.CURRENCY,
    AggregationStrategy.SUM,
    ['ADVERTISING'],
  ],
  [
    'ADS_CONVERSIONS',
    'Advertising Conversions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['ADVERTISING'],
  ],
  [
    'ADS_CTR',
    'Advertising CTR',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['ADVERTISING'],
  ],
  [
    'ADS_CPC',
    'Cost per Click',
    MetricKind.DERIVED,
    MetricUnit.CURRENCY,
    AggregationStrategy.DERIVED,
    ['ADVERTISING'],
  ],
  [
    'ADS_CONVERSION_RATE',
    'Advertising Conversion Rate',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['ADVERTISING'],
  ],
  [
    'SEO_ORGANIC_TRAFFIC',
    'Organic Traffic',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SEO'],
  ],
  [
    'SEO_SEARCH_IMPRESSIONS',
    'Search Impressions',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SEO'],
  ],
  [
    'SEO_SEARCH_CLICKS',
    'Search Clicks',
    MetricKind.RAW,
    MetricUnit.COUNT,
    AggregationStrategy.SUM,
    ['SEO'],
  ],
  [
    'SEO_AVG_POSITION',
    'Average Search Position',
    MetricKind.RAW,
    MetricUnit.POSITION,
    AggregationStrategy.WEIGHTED_AVERAGE,
    ['SEO'],
  ],
  [
    'SEO_CTR',
    'Search CTR',
    MetricKind.DERIVED,
    MetricUnit.PERCENT,
    AggregationStrategy.DERIVED,
    ['SEO'],
  ],
];

async function main() {
  for (const [code, name] of [
    ['ADMIN', 'Administrator'],
    ['MARKETING_OFFICER', 'Marketing Officer'],
    ['MANAGEMENT', 'Management'],
  ] as const)
    await prisma.role.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  const channelIds = new Map<string, string>();
  for (const [code, name] of channels) {
    const channel = await prisma.marketingChannel.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
    channelIds.set(code, channel.id);
  }
  for (const [channelCode, code, name] of platforms)
    await prisma.platform.upsert({
      where: {
        channelId_code: { channelId: channelIds.get(channelCode)!, code },
      },
      update: { name },
      create: { channelId: channelIds.get(channelCode)!, code, name },
    });
  const legacyMailchimp = await prisma.platform.findFirst({
    where: { code: 'MAILCHIMP' },
    include: { campaignPlatforms: { select: { id: true }, take: 1 } },
  });
  if (legacyMailchimp && legacyMailchimp.campaignPlatforms.length === 0)
    await prisma.platform.update({
      where: { id: legacyMailchimp.id },
      data: {
        active: false,
        archivedAt: legacyMailchimp.archivedAt ?? new Date(),
      },
    });
  for (const [
    code,
    name,
    kind,
    unit,
    aggregationStrategy,
    applicableChannels,
  ] of metrics) {
    const metric = await prisma.metricDefinition.upsert({
      where: { code },
      update: { name, kind, unit, aggregationStrategy },
      create: { code, name, kind, unit, aggregationStrategy },
    });
    for (const channelCode of applicableChannels)
      await prisma.channelMetric.upsert({
        where: {
          channelId_metricDefinitionId: {
            channelId: channelIds.get(channelCode)!,
            metricDefinitionId: metric.id,
          },
        },
        update: { inputEnabled: kind === MetricKind.RAW },
        create: {
          channelId: channelIds.get(channelCode)!,
          metricDefinitionId: metric.id,
          inputEnabled: kind === MetricKind.RAW,
        },
      });
  }
  for (const [code, name, kind] of metrics) {
    if (kind !== MetricKind.DERIVED) continue;
    const metric = await prisma.metricDefinition.findUniqueOrThrow({
      where: { code },
    });
    await prisma.kpiDefinition.upsert({
      where: { metricDefinitionId: metric.id },
      update: { name, active: true },
      create: {
        metricDefinitionId: metric.id,
        name,
        description: `Approved derived KPI: ${name}`,
      },
    });
  }
  if (process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
    });
    const passwordHash = await argon2.hash(process.env.SEED_ADMIN_PASSWORD, {
      type: argon2.argon2id,
    });
    await prisma.user.upsert({
      where: { email: process.env.SEED_ADMIN_EMAIL.toLowerCase() },
      update: { active: true, roleId: role.id, passwordHash },
      create: {
        name: 'Local Administrator',
        email: process.env.SEED_ADMIN_EMAIL.toLowerCase(),
        roleId: role.id,
        passwordHash,
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
