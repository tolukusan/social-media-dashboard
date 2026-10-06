import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import argon2 from 'argon2';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Platform } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl: string;
const fixtureUsers: Array<{ id: string; email: string; password: string }> = [];
let adminFixture: (typeof fixtureUsers)[number];
let managementFixture: (typeof fixtureUsers)[number];
let marketingFixture: (typeof fixtureUsers)[number];

async function createFixtureUser(roleCode: string) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });
  const email = `f03-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  const user = await prisma.user.create({
    data: {
      name: 'F03 Integration User',
      email,
      roleId: role.id,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });
  const fixture = { id: user.id, email, password };
  fixtureUsers.push(fixture);
  return fixture;
}

async function authenticate(email: string, password: string) {
  const csrfResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  const csrf = (await csrfResponse.json()) as { csrfToken: string };
  const csrfCookie = csrfResponse.headers
    .get('set-cookie')
    ?.match(/csrf_token=[^;]+/)?.[0];
  if (!csrfCookie) throw new Error('CSRF cookie was not issued.');
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!login.ok) throw new Error('Integration fixture login failed.');
  const sessionCookie = login.headers
    .get('set-cookie')
    ?.match(/smd_session=[^;]+/)?.[0];
  if (!sessionCookie) throw new Error('Session cookie was not issued.');
  return {
    csrfToken: csrf.csrfToken,
    cookie: `${csrfCookie}; ${sessionCookie}`,
  };
}

describe('isolated PostgreSQL and HTTP session guard', () => {
  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    [adminFixture, managementFixture, marketingFixture] = await Promise.all([
      createFixtureUser('ADMIN'),
      createFixtureUser('MANAGEMENT'),
      createFixtureUser('MARKETING_OFFICER'),
    ]);
  });

  afterAll(async () => {
    await app?.close();
    if (fixtureUsers.length) {
      const userIds = fixtureUsers.map((user) => user.id);
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
  });

  it('serves health and denies protected reads without a session', async () => {
    const health = await fetch(`${baseUrl}/api/v1/health`);
    if (health.status !== 200)
      throw new Error('Health route did not return 200.');
    const response = await fetch(`${baseUrl}/api/v1/channels`);
    if (response.status !== 401)
      throw new Error(
        `Expected an unauthenticated request to be denied; received ${response.status}.`,
      );
    const body = (await response.json()) as { code?: string };
    if (body.code !== 'UNAUTHENTICATED')
      throw new Error('Session guard returned an unexpected error.');
  });

  it('enforces PostgreSQL platform uniqueness and cleans up its fixture', async () => {
    const channel = await prisma.marketingChannel.findUniqueOrThrow({
      where: { code: 'SOCIAL' },
    });
    const code = `TEST_${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`;
    let fixture: Platform | undefined;
    try {
      fixture = await prisma.platform.create({
        data: {
          channelId: channel.id,
          code,
          name: 'Isolated integrity fixture',
        },
      });
      let rejected = false;
      try {
        await prisma.platform.create({
          data: {
            channelId: channel.id,
            code,
            name: 'Duplicate integrity fixture',
          },
        });
      } catch (error) {
        rejected =
          error instanceof Error && 'code' in error && error.code === 'P2002';
      }
      if (!rejected)
        throw new Error('Database did not reject the duplicate platform code.');
    } finally {
      if (fixture) await prisma.platform.delete({ where: { id: fixture.id } });
    }
  });

  it('allows catalogue writes only for administrators and preserves deactivated catalogue rows', async () => {
    const adminAuth = await authenticate(
      adminFixture.email,
      adminFixture.password,
    );
    const managementAuth = await authenticate(
      managementFixture.email,
      managementFixture.password,
    );
    const code = `F04_${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    let channelId: string | undefined;
    let platformId: string | undefined;
    try {
      const denied = await fetch(`${baseUrl}/api/v1/channels`, {
        method: 'POST',
        headers: {
          cookie: managementAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': managementAuth.csrfToken,
        },
        body: JSON.stringify({
          code: `${code}_DENIED`,
          name: 'Denied channel',
        }),
      });
      if (denied.status !== 403)
        throw new Error('Management was allowed to create a channel.');

      const created = await fetch(`${baseUrl}/api/v1/channels`, {
        method: 'POST',
        headers: {
          cookie: adminAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': adminAuth.csrfToken,
        },
        body: JSON.stringify({
          code: code.toLowerCase(),
          name: 'F04 Catalogue Fixture',
        }),
      });
      if (!created.ok)
        throw new Error('Administrator could not create a channel.');
      const channel = (await created.json()) as { id: string; code: string };
      channelId = channel.id;
      if (channel.code !== code)
        throw new Error('Channel code was not normalized.');

      const platformResponse = await fetch(`${baseUrl}/api/v1/platforms`, {
        method: 'POST',
        headers: {
          cookie: adminAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': adminAuth.csrfToken,
        },
        body: JSON.stringify({
          channelId,
          code: 'FIXTURE',
          name: 'F04 Platform Fixture',
        }),
      });
      if (!platformResponse.ok)
        throw new Error('Administrator could not create a platform.');
      platformId = ((await platformResponse.json()) as { id: string }).id;

      const deactivated = await fetch(
        `${baseUrl}/api/v1/channels/${channelId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({ active: false }),
        },
      );
      if (!deactivated.ok)
        throw new Error('Administrator could not deactivate a channel.');
      const retained = await prisma.marketingChannel.findUnique({
        where: { id: channelId },
      });
      if (!retained || retained.active || !retained.archivedAt)
        throw new Error('Deactivation did not preserve the archived channel.');
    } finally {
      if (platformId)
        await prisma.platform.delete({ where: { id: platformId } });
      if (channelId)
        await prisma.marketingChannel.delete({ where: { id: channelId } });
    }
  });

  it('supports safe campaign editing, validates updates, and restricts completed structural changes', async () => {
    const adminAuth = await authenticate(
      adminFixture.email,
      adminFixture.password,
    );
    const marketingAuth = await authenticate(
      marketingFixture.email,
      marketingFixture.password,
    );
    const managementAuth = await authenticate(
      managementFixture.email,
      managementFixture.password,
    );
    const channel = await prisma.marketingChannel.findUniqueOrThrow({
      where: { code: 'SOCIAL' },
    });
    const platform = await prisma.platform.findFirstOrThrow({
      where: { channelId: channel.id, active: true },
    });
    const extraCode = `F04_${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
    const extraPlatform = await prisma.platform.create({
      data: {
        channelId: channel.id,
        code: extraCode,
        name: 'F04 Additional Platform',
      },
    });
    const officerRole = await prisma.role.findUniqueOrThrow({
      where: { code: 'MARKETING_OFFICER' },
    });
    const inactiveResponsible = await prisma.user.create({
      data: {
        name: 'Inactive campaign assignee fixture',
        email: `f04-inactive-${randomUUID()}@example.invalid`,
        roleId: officerRole.id,
        passwordHash: await argon2.hash(randomUUID(), {
          type: argon2.argon2id,
        }),
        active: false,
        deactivatedAt: new Date(),
      },
    });
    let campaignId: string | undefined;
    try {
      const created = await fetch(`${baseUrl}/api/v1/campaigns`, {
        method: 'POST',
        headers: {
          cookie: adminAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': adminAuth.csrfToken,
        },
        body: JSON.stringify({
          name: 'F04 Campaign Fixture',
          startDate: '2025-01-01',
          endDate: '2025-01-31',
          status: 'COMPLETED',
          responsibleUserId: adminFixture.id,
          channels: [{ channelId: channel.id, platformIds: [platform.id] }],
        }),
      });
      if (!created.ok)
        throw new Error('Administrator could not create the campaign fixture.');
      campaignId = ((await created.json()) as { id: string }).id;

      const metadataUpdate = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: marketingAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': marketingAuth.csrfToken,
          },
          body: JSON.stringify({
            name: 'F04 Campaign Metadata Updated',
            endDate: null,
          }),
        },
      );
      if (!metadataUpdate.ok)
        throw new Error(
          'Marketing Officer could not edit completed campaign metadata.',
        );

      const structuralUpdate = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: marketingAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': marketingAuth.csrfToken,
          },
          body: JSON.stringify({
            channels: [
              {
                channelId: channel.id,
                platformIds: [platform.id, extraPlatform.id],
              },
            ],
          }),
        },
      );
      if (structuralUpdate.status !== 403)
        throw new Error(
          'Marketing Officer changed completed campaign structure.',
        );

      const invalidStatus = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({ status: 'UNKNOWN' }),
        },
      );
      if (invalidStatus.status !== 400)
        throw new Error('Invalid campaign status was accepted.');

      const invalidDates = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({
            startDate: '2025-02-01',
            endDate: '2025-01-31',
          }),
        },
      );
      if (invalidDates.status !== 400)
        throw new Error('Invalid campaign date range was accepted.');

      const invalidResponsible = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({ responsibleUserId: inactiveResponsible.id }),
        },
      );
      if (invalidResponsible.status !== 400)
        throw new Error('Missing campaign assignee was accepted.');

      const otherChannel = await prisma.marketingChannel.findFirstOrThrow({
        where: { id: { not: channel.id }, active: true },
      });
      const mismatchedPlatform = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({
            channels: [
              { channelId: channel.id, platformIds: [platform.id] },
              { channelId: otherChannel.id, platformIds: [platform.id] },
            ],
          }),
        },
      );
      if (mismatchedPlatform.status !== 400)
        throw new Error('Platform/channel mismatch was accepted.');

      const forbiddenUpdate = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: managementAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': managementAuth.csrfToken,
          },
          body: JSON.stringify({ name: 'Forbidden Campaign Update' }),
        },
      );
      if (forbiddenUpdate.status !== 403)
        throw new Error('Management was allowed to edit a campaign.');

      const adminStructuralUpdate = await fetch(
        `${baseUrl}/api/v1/campaigns/${campaignId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({
            channels: [
              {
                channelId: channel.id,
                platformIds: [platform.id, extraPlatform.id],
              },
            ],
          }),
        },
      );
      if (!adminStructuralUpdate.ok)
        throw new Error(
          'Administrator could not safely extend completed campaign structure.',
        );

      const persisted = await prisma.campaign.findUniqueOrThrow({
        where: { id: campaignId },
      });
      if (
        persisted.name !== 'F04 Campaign Metadata Updated' ||
        persisted.endDate !== null
      )
        throw new Error('Invalid/forbidden updates changed campaign data.');
    } finally {
      if (campaignId) {
        const links = await prisma.campaignChannel.findMany({
          where: { campaignId },
          select: { id: true },
        });
        const ids = links.map((link) => link.id);
        await prisma.campaignPlatform.deleteMany({
          where: { campaignChannelId: { in: ids } },
        });
        await prisma.campaignChannel.deleteMany({ where: { campaignId } });
        await prisma.campaign.delete({ where: { id: campaignId } });
      }
      await prisma.platform.delete({ where: { id: extraPlatform.id } });
      await prisma.user.delete({ where: { id: inactiveResponsible.id } });
    }
  });

  it('validates raw performance entry, preserves zero/missing values, resolves duplicates, and archives safely', async () => {
    const adminAuth = await authenticate(
      adminFixture.email,
      adminFixture.password,
    );
    const marketingAuth = await authenticate(
      marketingFixture.email,
      marketingFixture.password,
    );
    const managementAuth = await authenticate(
      managementFixture.email,
      managementFixture.password,
    );
    const channel = await prisma.marketingChannel.findUniqueOrThrow({
      where: { code: 'SOCIAL' },
    });
    const platform = await prisma.platform.findFirstOrThrow({
      where: { channelId: channel.id, active: true },
    });
    const countMapping = await prisma.channelMetric.findFirstOrThrow({
      where: {
        channelId: channel.id,
        active: true,
        inputEnabled: true,
        metricDefinition: { active: true, kind: 'RAW', unit: 'COUNT' },
      },
      include: { metricDefinition: true },
    });
    const clicksMapping = await prisma.channelMetric.findFirstOrThrow({
      where: {
        channelId: channel.id,
        active: true,
        inputEnabled: true,
        metricDefinition: { code: 'SM_LINK_CLICKS', active: true },
      },
      include: { metricDefinition: true },
    });
    const impressionsMapping = await prisma.channelMetric.findFirstOrThrow({
      where: {
        channelId: channel.id,
        active: true,
        inputEnabled: true,
        metricDefinition: { code: 'SM_IMPRESSIONS', active: true },
      },
      include: { metricDefinition: true },
    });
    const derivedMapping = await prisma.channelMetric.findFirst({
      where: {
        channelId: channel.id,
        active: true,
        metricDefinition: { kind: 'DERIVED' },
      },
      include: { metricDefinition: true },
    });
    let campaignId: string | undefined;
    let comparisonCampaignId: string | undefined;
    let campaignPlatformId: string | undefined;
    let createdRecordId: string | undefined;
    let createdTargetId: string | undefined;
    try {
      const metricMetadata = await fetch(
        `${baseUrl}/api/v1/channels/${channel.id}/metrics`,
        { headers: { cookie: adminAuth.cookie } },
      );
      if (!metricMetadata.ok)
        throw new Error('Applicable metric metadata could not be loaded.');
      const metrics = (await metricMetadata.json()) as Array<{
        code: string;
        unit: string;
        kind: string;
        inputEnabled: boolean;
      }>;
      if (
        !metrics.some(
          (metric) =>
            metric.code === countMapping.metricDefinition.code &&
            metric.unit === 'COUNT' &&
            metric.kind === 'RAW' &&
            metric.inputEnabled,
        )
      )
        throw new Error('Metric metadata omitted an applicable raw metric.');

      const campaignResponse = await fetch(`${baseUrl}/api/v1/campaigns`, {
        method: 'POST',
        headers: {
          cookie: adminAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': adminAuth.csrfToken,
        },
        body: JSON.stringify({
          name: 'F05 Performance Fixture',
          startDate: '2020-01-01',
          responsibleUserId: adminFixture.id,
          channels: [{ channelId: channel.id, platformIds: [platform.id] }],
        }),
      });
      if (!campaignResponse.ok)
        throw new Error(
          'Administrator could not create the performance fixture campaign.',
        );
      const campaign = (await campaignResponse.json()) as {
        id: string;
        campaignChannels: Array<{ campaignPlatforms: Array<{ id: string }> }>;
      };
      campaignId = campaign.id;
      campaignPlatformId =
        campaign.campaignChannels[0]?.campaignPlatforms[0]?.id;
      if (!campaignPlatformId)
        throw new Error(
          'Campaign fixture did not return its campaign-platform identity.',
        );

      const secondCampaignResponse = await fetch(
        `${baseUrl}/api/v1/campaigns`,
        {
          method: 'POST',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({
            name: 'F06 Comparison Fixture',
            startDate: '2020-01-01',
            responsibleUserId: adminFixture.id,
            channels: [{ channelId: channel.id, platformIds: [platform.id] }],
          }),
        },
      );
      if (!secondCampaignResponse.ok)
        throw new Error('Could not create campaign comparison fixture.');
      comparisonCampaignId = (
        (await secondCampaignResponse.json()) as { id: string }
      ).id;

      const ctrDefinition = await prisma.kpiDefinition.findFirstOrThrow({
        where: {
          active: true,
          metricDefinition: { code: 'SM_CTR', active: true },
        },
      });
      const targetBody = {
        kpiDefinitionId: ctrDefinition.id,
        periodType: 'MONTHLY',
        targetValue: 10,
        scopeType: 'GLOBAL',
        comparisonRule: 'HIGHER_IS_BETTER',
        effectiveFrom: '2024-01-01',
        effectiveTo: '2024-01-31',
      };
      const deniedTarget = await fetch(`${baseUrl}/api/v1/targets`, {
        method: 'POST',
        headers: {
          cookie: managementAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': managementAuth.csrfToken,
        },
        body: JSON.stringify(targetBody),
      });
      if (deniedTarget.status !== 403)
        throw new Error('Management was allowed to create a KPI target.');
      const invalidTargetScope = await fetch(`${baseUrl}/api/v1/targets`, {
        method: 'POST',
        headers: {
          cookie: adminAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': adminAuth.csrfToken,
        },
        body: JSON.stringify({ ...targetBody, channelId: channel.id }),
      });
      if (invalidTargetScope.status !== 400)
        throw new Error('Contradictory target scope was accepted.');
      const targetWrites = await Promise.all([
        fetch(`${baseUrl}/api/v1/targets`, {
          method: 'POST',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify(targetBody),
        }),
        fetch(`${baseUrl}/api/v1/targets`, {
          method: 'POST',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify(targetBody),
        }),
      ]);
      const successfulTarget = targetWrites.find(
        (response) => response.status === 201,
      );
      if (
        !successfulTarget ||
        targetWrites.filter((response) => response.status === 409).length !== 1
      )
        throw new Error(
          'Concurrent overlapping target writes did not resolve to one create and one conflict.',
        );
      createdTargetId = ((await successfulTarget.json()) as { id: string }).id;

      const request = (
        auth: typeof adminAuth,
        date: string,
        values: Record<string, number>,
      ) =>
        fetch(`${baseUrl}/api/v1/performance-records`, {
          method: 'POST',
          headers: {
            cookie: auth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': auth.csrfToken,
          },
          body: JSON.stringify({
            campaignPlatformId,
            recordDate: date,
            values,
          }),
        });
      const denied = await request(managementAuth, '2024-01-01', {
        [countMapping.metricDefinition.code]: 0,
      });
      if (denied.status !== 403)
        throw new Error(
          'Management was allowed to create a performance record.',
        );
      const future = await request(adminAuth, '2999-01-01', {
        [countMapping.metricDefinition.code]: 0,
      });
      if (future.status !== 400)
        throw new Error('Future-dated performance was accepted.');
      const outsideCampaign = await request(adminAuth, '2019-12-31', {
        [countMapping.metricDefinition.code]: 0,
      });
      if (outsideCampaign.status !== 400)
        throw new Error('Out-of-campaign performance was accepted.');
      const fraction = await request(adminAuth, '2024-01-02', {
        [countMapping.metricDefinition.code]: 1.5,
      });
      if (fraction.status !== 400)
        throw new Error('Fractional count metric was accepted.');
      const negative = await request(adminAuth, '2024-01-03', {
        [countMapping.metricDefinition.code]: -1,
      });
      if (negative.status !== 400)
        throw new Error('Negative metric value was accepted.');
      if (derivedMapping) {
        const derived = await request(adminAuth, '2024-01-04', {
          [derivedMapping.metricDefinition.code]: 1,
        });
        if (derived.status !== 400)
          throw new Error('Derived metric was accepted as raw input.');
      }

      const concurrent = await Promise.all([
        request(adminAuth, '2024-01-05', {
          [countMapping.metricDefinition.code]: 0,
          [clicksMapping.metricDefinition.code]: 90,
          [impressionsMapping.metricDefinition.code]: 1010,
        }),
        request(marketingAuth, '2024-01-05', {
          [countMapping.metricDefinition.code]: 0,
          [clicksMapping.metricDefinition.code]: 90,
          [impressionsMapping.metricDefinition.code]: 1010,
        }),
      ]);
      const successIndex = concurrent.findIndex(
        (response) => response.status === 201,
      );
      if (
        successIndex < 0 ||
        concurrent.filter((response) => response.status === 409).length !== 1
      )
        throw new Error(
          'Concurrent duplicate submissions did not resolve to one create and one conflict.',
        );
      createdRecordId = (
        (await concurrent[successIndex].json()) as { id: string }
      ).id;
      const record = await prisma.performanceRecord.findUniqueOrThrow({
        where: { id: createdRecordId },
        include: { metricValues: { include: { metricDefinition: true } } },
      });
      if (
        record.metricValues.length !== 3 ||
        Number(
          record.metricValues.find(
            (value) =>
              value.metricDefinition.code ===
              countMapping.metricDefinition.code,
          )?.value,
        ) !== 0
      )
        throw new Error(
          'Explicit zero was not persisted distinctly from omitted metrics.',
        );

      const analyticsParams = new URLSearchParams({
        from: '2024-01-05',
        to: '2024-01-05',
        campaignId,
        channelId: channel.id,
        platformId: platform.id,
        metricCode: countMapping.metricDefinition.code,
      });
      const dashboardResponse = await fetch(
        `${baseUrl}/api/v1/analytics/dashboard?${analyticsParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (!dashboardResponse.ok)
        throw new Error('Filtered analytics dashboard request failed.');
      const dashboard = (await dashboardResponse.json()) as {
        recordCount: number;
        campaignCount: number;
        channelCount: number;
        rawTotals: Record<string, number | null>;
        metricMetadata: Array<{
          code: string;
          unit: string;
          kind: string;
          aggregationStrategy: string;
        }>;
      };
      const selectedMetric = dashboard.metricMetadata.find(
        (metric) => metric.code === countMapping.metricDefinition.code,
      );
      if (
        dashboard.recordCount !== 1 ||
        dashboard.campaignCount !== 1 ||
        dashboard.channelCount !== 1 ||
        dashboard.rawTotals[countMapping.metricDefinition.code] !== 0 ||
        selectedMetric?.kind !== 'RAW' ||
        selectedMetric.unit !== 'COUNT' ||
        !selectedMetric.aggregationStrategy
      )
        throw new Error(
          'Filtered analytics lost scope, explicit zero, or metric metadata.',
        );

      const targetParams = new URLSearchParams({
        from: '2024-01-01',
        to: '2024-01-31',
        campaignId,
        channelId: channel.id,
        platformId: platform.id,
        metricCode: 'SM_CTR',
        targetPeriod: 'MONTHLY',
      });
      const targetDashboard = await fetch(
        `${baseUrl}/api/v1/analytics/dashboard?${targetParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (!targetDashboard.ok)
        throw new Error('Monthly KPI target evaluation failed.');
      const targetResult = (await targetDashboard.json()) as {
        targetEvaluations: Record<
          string,
          {
            actual: number | null;
            target: { scopeType: string } | null;
            status: string | null;
          }
        >;
      };
      if (
        targetResult.targetEvaluations.SM_CTR.actual === null ||
        targetResult.targetEvaluations.SM_CTR.target?.scopeType !== 'GLOBAL' ||
        targetResult.targetEvaluations.SM_CTR.status !== 'MISSES_TARGET'
      )
        throw new Error(
          `Applicable KPI target mismatch: ${JSON.stringify(targetResult.targetEvaluations.SM_CTR)}`,
        );

      const shortenedTarget = await fetch(
        `${baseUrl}/api/v1/targets/${createdTargetId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: adminAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': adminAuth.csrfToken,
          },
          body: JSON.stringify({ effectiveTo: '2024-01-20' }),
        },
      );
      if (!shortenedTarget.ok)
        throw new Error('Could not narrow target effective-date coverage.');
      const partialCoverageResponse = await fetch(
        `${baseUrl}/api/v1/analytics/dashboard?${targetParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      const partialCoverage = (await partialCoverageResponse.json()) as {
        targetEvaluations: Record<
          string,
          { target: unknown; status: string | null }
        >;
      };
      if (
        partialCoverage.targetEvaluations.SM_CTR.target !== null ||
        partialCoverage.targetEvaluations.SM_CTR.status !== 'NO_TARGET'
      )
        throw new Error(
          'Partially effective target was applied to a full month.',
        );

      const partialPeriodResponse = await fetch(
        `${baseUrl}/api/v1/analytics/dashboard?${new URLSearchParams({
          from: '2024-01-05',
          to: '2024-01-31',
          campaignId,
          metricCode: 'SM_CTR',
          targetPeriod: 'MONTHLY',
        })}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (partialPeriodResponse.status !== 400)
        throw new Error(
          'Partial calendar range was accepted for monthly target evaluation.',
        );

      const unresolvedPeriodResponse = await fetch(
        `${baseUrl}/api/v1/analytics/dashboard?${new URLSearchParams({
          campaignId: comparisonCampaignId!,
          metricCode: 'SM_CTR',
          targetPeriod: 'CAMPAIGN',
        })}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      const unresolvedPeriod = (await unresolvedPeriodResponse.json()) as {
        targetEvaluations: Record<
          string,
          {
            actual: number | null;
            target: unknown;
            status: string | null;
            statusDecisionRequired?: boolean;
          }
        >;
      };
      if (
        !unresolvedPeriodResponse.ok ||
        unresolvedPeriod.targetEvaluations.SM_CTR.actual !== null ||
        unresolvedPeriod.targetEvaluations.SM_CTR.target !== null ||
        unresolvedPeriod.targetEvaluations.SM_CTR.status !== null ||
        !unresolvedPeriod.targetEvaluations.SM_CTR.statusDecisionRequired
      )
        throw new Error(
          'Unresolved no-data/no-target status was misrepresented.',
        );

      const trendsResponse = await fetch(
        `${baseUrl}/api/v1/analytics/trends?${analyticsParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (!trendsResponse.ok)
        throw new Error('Filtered analytics trends request failed.');
      const trends = (await trendsResponse.json()) as {
        points: Array<{ rawTotals: Record<string, number | null> }>;
      };
      if (
        trends.points.length !== 1 ||
        trends.points[0].rawTotals[countMapping.metricDefinition.code] !== 0
      )
        throw new Error('Trends did not preserve selected filters and zero.');

      const gapParams = new URLSearchParams({
        from: '2024-01-05',
        to: '2024-01-06',
        campaignId,
        channelId: channel.id,
        platformId: platform.id,
        metricCode: countMapping.metricDefinition.code,
      });
      const gapResponse = await fetch(
        `${baseUrl}/api/v1/analytics/trends?${gapParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      const gaps = (await gapResponse.json()) as {
        points: Array<{
          bucket: string;
          rawTotals: Record<string, number | null>;
        }>;
      };
      if (
        gaps.points.length !== 2 ||
        gaps.points[1].rawTotals[countMapping.metricDefinition.code] !== null
      )
        throw new Error(
          'Missing trend buckets were not represented as unavailable.',
        );

      const comparisonParams = new URLSearchParams({
        from: '2024-01-01',
        to: '2024-01-05',
        campaignId,
        channelId: channel.id,
        platformId: platform.id,
        metricCode: countMapping.metricDefinition.code,
        comparisonPeriod: 'MONTH',
      });
      const comparisonResponse = await fetch(
        `${baseUrl}/api/v1/analytics/comparison?${comparisonParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (!comparisonResponse.ok)
        throw new Error('Calendar-period analytics comparison failed.');
      const comparison = (await comparisonResponse.json()) as {
        type: string;
        isPartial: boolean;
        previousPeriod: { from: string; to: string };
        difference: Record<string, number | null>;
        percentageChange: Record<string, number | null>;
      };
      if (
        comparison.type !== 'MONTH' ||
        !comparison.isPartial ||
        comparison.previousPeriod.from.slice(0, 10) !== '2023-12-01' ||
        comparison.previousPeriod.to.slice(0, 10) !== '2023-12-05' ||
        comparison.difference[countMapping.metricDefinition.code] !== null ||
        comparison.percentageChange[countMapping.metricDefinition.code] !== null
      )
        throw new Error(
          'Calendar period boundaries or unavailable change were incorrect.',
        );

      const dimensionParams = new URLSearchParams({
        dimension: 'CAMPAIGN',
        dimensionIds: `${campaignId},${comparisonCampaignId}`,
        comparisonMode: 'LIFETIME',
        metricCode: countMapping.metricDefinition.code,
      });
      const dimensionResponse = await fetch(
        `${baseUrl}/api/v1/analytics/dimension-comparison?${dimensionParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (!dimensionResponse.ok)
        throw new Error('Campaign lifetime comparison was rejected.');
      const dimension = (await dimensionResponse.json()) as {
        mode: string;
        results: Array<{
          id: string;
          durationDays?: number;
          value: number | null;
        }>;
      };
      if (
        dimension.mode !== 'LIFETIME' ||
        dimension.results.length !== 2 ||
        dimension.results.some(
          (item) => !item.durationDays || item.durationDays < 1,
        )
      )
        throw new Error('Campaign comparison omitted values or durations.');

      const otherChannel = await prisma.marketingChannel.findFirstOrThrow({
        where: { id: { not: channel.id }, active: true },
      });
      const incompatibleChannels = new URLSearchParams({
        dimension: 'CHANNEL',
        dimensionIds: `${channel.id},${otherChannel.id}`,
        comparisonMode: 'PERIOD',
        metricCode: 'SM_CTR',
        from: '2024-01-05',
        to: '2024-01-05',
      });
      const incompatibleResponse = await fetch(
        `${baseUrl}/api/v1/analytics/dimension-comparison?${incompatibleChannels}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (incompatibleResponse.status !== 400)
        throw new Error(
          'A channel comparison with an inapplicable KPI was accepted.',
        );

      const reportResponse = await fetch(
        `${baseUrl}/api/v1/reports/dashboard.pdf?${analyticsParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      if (!reportResponse.ok)
        throw new Error('Filtered analytics report request failed.');
      const anonymousReportPreview = await fetch(
        `${baseUrl}/api/v1/reports/preview?${analyticsParams}`,
      );
      if (anonymousReportPreview.status !== 401)
        throw new Error('Anonymous report preview access was not denied.');
      const reportPreviewResponse = await fetch(
        `${baseUrl}/api/v1/reports/preview?${analyticsParams}&comparisonPeriod=CUSTOM`,
        { headers: { cookie: managementAuth.cookie } },
      );
      const reportPreview = (await reportPreviewResponse.json()) as {
        title: string;
        period: { from: string | null; to: string | null };
        summary: {
          recordCount: number;
          kpis: Array<{ code: string; value: number | null }>;
        };
        comparison: { metric: string } | null;
        trend: {
          metric: string;
          points: Array<{ bucket: string; value: number | null }>;
        } | null;
      };
      if (
        !reportPreviewResponse.ok ||
        reportPreview.title !== 'Digital Marketing Performance Report' ||
        reportPreview.period.from?.slice(0, 10) !== '2024-01-05' ||
        reportPreview.period.to?.slice(0, 10) !== '2024-01-05' ||
        reportPreview.summary.recordCount !== 1 ||
        reportPreview.summary.kpis[0]?.code !==
          countMapping.metricDefinition.code ||
        reportPreview.summary.kpis[0]?.value !== 0 ||
        reportPreview.comparison === null ||
        reportPreview.trend?.points[0]?.value !== 0
      )
        throw new Error(
          'Report preview diverged from the filtered dashboard, comparison, or trend data.',
        );
      const targetedReportParams = new URLSearchParams(targetParams);
      const targetedReportResponse = await fetch(
        `${baseUrl}/api/v1/reports/dashboard.pdf?${targetedReportParams}`,
        { headers: { cookie: managementAuth.cookie } },
      );
      const targetedReportText = Buffer.from(
        await targetedReportResponse.arrayBuffer(),
      ).toString('latin1');
      if (
        !targetedReportResponse.ok ||
        !targetedReportText.includes('target: No target; status: NO_TARGET')
      )
        throw new Error(
          'PDF report did not reuse the current dashboard target evaluation.',
        );

      const managementUpdate = await fetch(
        `${baseUrl}/api/v1/performance-records/${createdRecordId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: managementAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': managementAuth.csrfToken,
          },
          body: JSON.stringify({ notes: 'Forbidden update' }),
        },
      );
      if (managementUpdate.status !== 403)
        throw new Error('Management was allowed to edit a performance record.');
      const managementArchive = await fetch(
        `${baseUrl}/api/v1/performance-records/${createdRecordId}`,
        {
          method: 'DELETE',
          headers: {
            cookie: managementAuth.cookie,
            'x-csrf-token': managementAuth.csrfToken,
          },
        },
      );
      if (managementArchive.status !== 403)
        throw new Error(
          'Management was allowed to archive a performance record.',
        );

      const edited = await fetch(
        `${baseUrl}/api/v1/performance-records/${createdRecordId}`,
        {
          method: 'PATCH',
          headers: {
            cookie: marketingAuth.cookie,
            'content-type': 'application/json',
            'x-csrf-token': marketingAuth.csrfToken,
          },
          body: JSON.stringify({ notes: 'Corrected by Marketing Officer' }),
        },
      );
      if (!edited.ok)
        throw new Error(
          'Marketing Officer could not update a performance record.',
        );
      const unchangedValues = await prisma.performanceMetricValue.findMany({
        where: { performanceRecordId: createdRecordId },
      });
      if (
        unchangedValues.length !== 3 ||
        Number(
          unchangedValues.find(
            (value) =>
              value.metricDefinitionId === countMapping.metricDefinitionId,
          )?.value,
        ) !== 0
      )
        throw new Error(
          'Omitting metric values during PATCH changed the raw metric set.',
        );

      const archived = await fetch(
        `${baseUrl}/api/v1/performance-records/${createdRecordId}`,
        {
          method: 'DELETE',
          headers: {
            cookie: adminAuth.cookie,
            'x-csrf-token': adminAuth.csrfToken,
          },
        },
      );
      if (!archived.ok)
        throw new Error(
          'Administrator could not archive the performance record.',
        );
      const retained = await prisma.performanceRecord.findUniqueOrThrow({
        where: { id: createdRecordId },
      });
      if (retained.status !== 'ARCHIVED')
        throw new Error('Archived record history was removed.');
      const normalList = await fetch(`${baseUrl}/api/v1/performance-records`, {
        headers: { cookie: adminAuth.cookie },
      });
      const listed = (await normalList.json()) as Array<{ id: string }>;
      if (listed.some((item) => item.id === createdRecordId))
        throw new Error(
          'Archived record remained in the normal performance list.',
        );
      const archivedDuplicate = await request(adminAuth, '2024-01-05', {
        [countMapping.metricDefinition.code]: 1,
      });
      if (archivedDuplicate.status !== 409)
        throw new Error('Archived date reservation was not preserved.');
    } finally {
      if (campaignPlatformId) {
        const testRecords = await prisma.performanceRecord.findMany({
          where: { campaignPlatformId },
          select: { id: true },
        });
        const recordIds = testRecords.map((record) => record.id);
        await prisma.auditLog.deleteMany({
          where: {
            entityType: 'PerformanceRecord',
            entityId: { in: recordIds },
          },
        });
        await prisma.performanceMetricValue.deleteMany({
          where: { performanceRecordId: { in: recordIds } },
        });
        await prisma.performanceRecord.deleteMany({
          where: { id: { in: recordIds } },
        });
      }
      if (createdTargetId)
        await prisma.kpiTarget.delete({ where: { id: createdTargetId } });
      for (const fixtureCampaignId of [campaignId, comparisonCampaignId]) {
        if (!fixtureCampaignId) continue;
        const links = await prisma.campaignChannel.findMany({
          where: { campaignId: fixtureCampaignId },
          select: { id: true },
        });
        const ids = links.map((link) => link.id);
        await prisma.campaignPlatform.deleteMany({
          where: { campaignChannelId: { in: ids } },
        });
        await prisma.campaignChannel.deleteMany({
          where: { campaignId: fixtureCampaignId },
        });
        await prisma.campaign.delete({ where: { id: fixtureCampaignId } });
      }
    }
  });

  it('protects user updates, scopes own profile changes, and never returns password hashes', async () => {
    const admin = adminFixture;
    const management = managementFixture;
    const adminAuth = await authenticate(admin.email, admin.password);
    const managementAuth = await authenticate(
      management.email,
      management.password,
    );
    const userList = await fetch(`${baseUrl}/api/v1/users`, {
      headers: { cookie: adminAuth.cookie },
    });
    if (!userList.ok) throw new Error('Administrator user list failed.');
    const users = (await userList.json()) as Array<Record<string, unknown>>;
    if (users.some((user) => 'passwordHash' in user))
      throw new Error('User list exposed a password hash.');

    const currentProfile = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { cookie: adminAuth.cookie },
    });
    const profile = (await currentProfile.json()) as Record<string, unknown>;
    if ('passwordHash' in profile)
      throw new Error('Current-user response exposed a password hash.');

    const withoutCsrf = await fetch(`${baseUrl}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: {
        cookie: adminAuth.cookie,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Rejected Profile Change' }),
    });
    if (withoutCsrf.status !== 403)
      throw new Error('Profile update without CSRF was not rejected.');

    const profileUpdate = await fetch(`${baseUrl}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: {
        cookie: adminAuth.cookie,
        'content-type': 'application/json',
        'x-csrf-token': adminAuth.csrfToken,
      },
      body: JSON.stringify({ name: 'Updated Own Profile' }),
    });
    if (!profileUpdate.ok)
      throw new Error('Authenticated profile update was rejected.');
    const updatedProfile = (await profileUpdate.json()) as Record<
      string,
      unknown
    >;
    if (
      updatedProfile.name !== 'Updated Own Profile' ||
      updatedProfile.id !== admin.id ||
      'passwordHash' in updatedProfile
    )
      throw new Error('Profile update returned incorrect or sensitive data.');

    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'MARKETING_OFFICER' },
    });
    const target = managementFixture;
    const updatedEmail = `updated-${randomUUID()}@example.invalid`;
    const adminUpdate = await fetch(`${baseUrl}/api/v1/users/${target.id}`, {
      method: 'PATCH',
      headers: {
        cookie: adminAuth.cookie,
        'content-type': 'application/json',
        'x-csrf-token': adminAuth.csrfToken,
      },
      body: JSON.stringify({
        name: 'Updated Managed User',
        email: updatedEmail.toUpperCase(),
        roleId: role.id,
      }),
    });
    if (!adminUpdate.ok)
      throw new Error('Administrator update of an existing user failed.');
    const updatedUser = (await adminUpdate.json()) as Record<string, unknown>;
    if (
      updatedUser.name !== 'Updated Managed User' ||
      updatedUser.email !== updatedEmail.toLowerCase() ||
      'passwordHash' in updatedUser
    )
      throw new Error(
        'Administrator update returned invalid or sensitive data.',
      );

    const duplicateEmail = await fetch(`${baseUrl}/api/v1/users/${target.id}`, {
      method: 'PATCH',
      headers: {
        cookie: adminAuth.cookie,
        'content-type': 'application/json',
        'x-csrf-token': adminAuth.csrfToken,
      },
      body: JSON.stringify({ email: admin.email.toUpperCase() }),
    });
    if (duplicateEmail.status !== 409)
      throw new Error('Duplicate normalized email was not rejected.');

    const forbiddenUpdate = await fetch(
      `${baseUrl}/api/v1/users/${target.id}`,
      {
        method: 'PATCH',
        headers: {
          cookie: managementAuth.cookie,
          'content-type': 'application/json',
          'x-csrf-token': managementAuth.csrfToken,
        },
        body: JSON.stringify({ name: 'Forbidden Update' }),
      },
    );
    if (forbiddenUpdate.status !== 403)
      throw new Error('Management user was allowed to update another user.');
    const unchanged = await prisma.user.findUniqueOrThrow({
      where: { id: target.id },
    });
    if (unchanged.name !== 'Updated Managed User')
      throw new Error('Forbidden update changed user data.');

    const invalidIdentity = await fetch(`${baseUrl}/api/v1/auth/me`, {
      method: 'PATCH',
      headers: {
        cookie: adminAuth.cookie,
        'content-type': 'application/json',
        'x-csrf-token': adminAuth.csrfToken,
      },
      body: JSON.stringify({
        name: 'Attempted Identity Switch',
        userId: target.id,
      }),
    });
    if (invalidIdentity.status !== 400)
      throw new Error(
        'Own-profile endpoint accepted a caller-supplied user ID.',
      );
  });
});
