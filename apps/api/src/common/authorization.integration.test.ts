import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import argon2 from 'argon2';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';

type Role = 'ADMIN' | 'MARKETING_OFFICER' | 'MANAGEMENT';
const roles: Role[] = ['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT'];
const operatorRoles: Role[] = ['ADMIN', 'MARKETING_OFFICER'];
const prefix =
  `AUTH_${randomUUID().replaceAll('-', '').slice(0, 12)}`.toUpperCase();
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const databaseUrl = process.env.TEST_DATABASE_URL!;
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const sql = new Client({ connectionString: databaseUrl });
const users: Array<{
  id: string;
  role: Role;
  roleId: string;
  email: string;
  password: string;
  cookie: string;
  csrf: string;
}> = [];
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let base: string;

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${base}/api/v1${path}`, init);
}

async function login(user: (typeof users)[number]) {
  const response = await request('/auth/csrf');
  const { csrfToken } = (await response.json()) as { csrfToken: string };
  const csrfCookie = response.headers
    .get('set-cookie')
    ?.match(/csrf_token=[^;]+/)?.[0];
  const signedIn = await request('/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  expect(signedIn.status).toBe(201);
  const session = signedIn.headers
    .get('set-cookie')
    ?.match(/smd_session=[^;]+/)?.[0];
  expect(csrfCookie && session).toBeTruthy();
  user.cookie = `${csrfCookie}; ${session}`;
  user.csrf = csrfToken;
}

function headers(user: (typeof users)[number]) {
  return {
    Origin: origin,
    Cookie: user.cookie,
    'x-csrf-token': user.csrf,
    'Content-Type': 'application/json',
  };
}

async function fingerprint() {
  // Session last-seen updates are expected on authenticated reads. Compare all
  // other application tables, including user credentials/recovery and audits,
  // without exposing their values in test output.
  const { rows } = await sql.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'social_media_dashboard'
       AND table_type = 'BASE TABLE' AND table_name NOT IN ('Session', '_prisma_migrations')
     ORDER BY table_name`,
  );
  const hash = createHash('sha256');
  for (const { table_name: table } of rows) {
    if (!/^[A-Za-z_]+$/.test(table)) throw new Error('Unexpected table name.');
    const result = await sql.query<{ digest: string }>(
      `SELECT md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) AS digest
       FROM "social_media_dashboard"."${table}" t`,
    );
    hash.update(table + result.rows[0].digest);
  }
  return hash.digest('hex');
}

async function context() {
  const actor = users[0];
  const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
  const channel = await prisma.marketingChannel.create({
    data: { code: `${prefix}_${suffix}`, name: 'Authorization fixture' },
  });
  const platform = await prisma.platform.create({
    data: {
      channelId: channel.id,
      code: `${prefix}_${suffix}`,
      name: 'Authorization fixture',
    },
  });
  const social = await prisma.marketingChannel.findUniqueOrThrow({
    where: { code: 'SOCIAL' },
  });
  const dataPlatform = await prisma.platform.findFirstOrThrow({
    where: { channelId: social.id, active: true },
  });
  const campaign = await prisma.campaign.create({
    data: {
      name: `${prefix} campaign`,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
      responsibleUserId: actor.id,
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
      campaignChannels: {
        create: {
          channelId: social.id,
          campaignPlatforms: { create: { platformId: dataPlatform.id } },
        },
      },
    },
    include: { campaignChannels: { include: { campaignPlatforms: true } } },
  });
  const campaignPlatformId =
    campaign.campaignChannels[0].campaignPlatforms[0].id;
  const record = await prisma.performanceRecord.create({
    data: {
      campaignPlatformId,
      recordDate: new Date('2024-01-01'),
      createdByUserId: actor.id,
      updatedByUserId: actor.id,
    },
  });
  const definition = await prisma.kpiDefinition.findFirstOrThrow({
    where: { metricDefinition: { code: 'SM_CTR' } },
  });
  const targetBody = {
    kpiDefinitionId: definition.id,
    scopeType: 'CAMPAIGN',
    campaignId: campaign.id,
    periodType: 'DAILY',
    targetValue: 5,
    comparisonRule: 'HIGHER_IS_BETTER',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2024-01-31',
  };
  const target = await prisma.kpiTarget.create({
    data: {
      ...targetBody,
      scopeType: 'CAMPAIGN',
      periodType: 'DAILY',
      comparisonRule: 'HIGHER_IS_BETTER',
      effectiveFrom: new Date('2024-01-01'),
      effectiveTo: new Date('2024-01-31'),
      createdByUserId: actor.id,
    },
  });
  const targetUser = await prisma.user.create({
    data: {
      name: `${prefix} target`,
      email: `${prefix}-${suffix}@example.invalid`,
      roleId: actor.roleId,
      passwordHash: await argon2.hash(randomUUID() + randomUUID()),
    },
  });
  return {
    suffix,
    channel,
    platform,
    social,
    dataPlatform,
    campaign,
    campaignPlatformId,
    record,
    target,
    targetBody,
    targetUser,
  };
}

type Context = Awaited<ReturnType<typeof context>>;
type Action = {
  name: string;
  method: string;
  allowed: Role[];
  path: (ctx: Context) => string;
  body?: (ctx: Context, user: (typeof users)[number]) => unknown;
  importStage?: 'preview' | 'map' | 'confirm';
};
const actions: Action[] = [
  {
    name: 'create user',
    method: 'POST',
    allowed: ['ADMIN'],
    path: () => '/users',
    body: (_ctx, user) => ({
      name: `${prefix} created`,
      email: `${prefix}-${randomUUID()}@example.invalid`,
      roleId: user.roleId,
      password: randomUUID() + randomUUID(),
    }),
  },
  {
    name: 'update user',
    method: 'PATCH',
    allowed: ['ADMIN'],
    path: (c) => `/users/${c.targetUser.id}`,
    body: () => ({ name: 'Updated fixture' }),
  },
  {
    name: 'deactivate user',
    method: 'DELETE',
    allowed: ['ADMIN'],
    path: (c) => `/users/${c.targetUser.id}`,
  },
  {
    name: 'reset user password',
    method: 'PATCH',
    allowed: ['ADMIN'],
    path: (c) => `/users/${c.targetUser.id}/password`,
    body: () => ({ password: randomUUID() + randomUUID() }),
  },
  {
    name: 'reactivate user',
    method: 'PATCH',
    allowed: ['ADMIN'],
    path: (c) => `/users/${c.targetUser.id}/reactivate`,
  },
  {
    name: 'create channel',
    method: 'POST',
    allowed: ['ADMIN'],
    path: () => '/channels',
    body: () => ({
      code: `${prefix}_${randomUUID().slice(0, 8)}`,
      name: 'Created fixture channel',
    }),
  },
  {
    name: 'update channel',
    method: 'PATCH',
    allowed: ['ADMIN'],
    path: (c) => `/channels/${c.channel.id}`,
    body: () => ({ name: 'Updated fixture channel' }),
  },
  {
    name: 'deactivate channel',
    method: 'DELETE',
    allowed: ['ADMIN'],
    path: (c) => `/channels/${c.channel.id}`,
  },
  {
    name: 'create platform',
    method: 'POST',
    allowed: ['ADMIN'],
    path: () => '/platforms',
    body: (c) => ({
      channelId: c.channel.id,
      code: `${prefix}_${randomUUID().slice(0, 8)}`,
      name: 'Created fixture platform',
    }),
  },
  {
    name: 'update platform',
    method: 'PATCH',
    allowed: ['ADMIN'],
    path: (c) => `/platforms/${c.platform.id}`,
    body: () => ({ name: 'Updated fixture platform' }),
  },
  {
    name: 'deactivate platform',
    method: 'DELETE',
    allowed: ['ADMIN'],
    path: (c) => `/platforms/${c.platform.id}`,
  },
  {
    name: 'create campaign',
    method: 'POST',
    allowed: operatorRoles,
    path: () => '/campaigns',
    body: (c, u) => ({
      name: `${prefix} created campaign`,
      startDate: '2024-01-01',
      responsibleUserId: u.id,
      channels: [{ channelId: c.social.id, platformIds: [c.dataPlatform.id] }],
    }),
  },
  {
    name: 'update campaign',
    method: 'PATCH',
    allowed: operatorRoles,
    path: (c) => `/campaigns/${c.campaign.id}`,
    body: () => ({ name: `${prefix} updated ${randomUUID()}` }),
  },
  {
    name: 'archive campaign',
    method: 'DELETE',
    allowed: ['ADMIN'],
    path: (c) => `/campaigns/${c.campaign.id}`,
  },
  {
    name: 'create performance',
    method: 'POST',
    allowed: operatorRoles,
    path: () => '/performance-records',
    body: (c, u) => ({
      campaignPlatformId: c.campaignPlatformId,
      recordDate: u.role === 'ADMIN' ? '2024-01-02' : '2024-01-03',
      values: { SM_IMPRESSIONS: 100, SM_LINK_CLICKS: 5 },
    }),
  },
  {
    name: 'update performance',
    method: 'PATCH',
    allowed: operatorRoles,
    path: (c) => `/performance-records/${c.record.id}`,
    body: () => ({
      values: { SM_IMPRESSIONS: 100, SM_LINK_CLICKS: 5 },
      notes: randomUUID(),
    }),
  },
  {
    name: 'archive performance',
    method: 'DELETE',
    allowed: ['ADMIN'],
    path: (c) => `/performance-records/${c.record.id}`,
  },
  {
    name: 'create target',
    method: 'POST',
    allowed: ['ADMIN'],
    path: () => '/targets',
    body: (c) => ({
      ...c.targetBody,
      effectiveFrom: '2024-02-01',
      effectiveTo: '2024-02-29',
    }),
  },
  {
    name: 'end-date target',
    method: 'PATCH',
    allowed: ['ADMIN'],
    path: (c) => `/targets/${c.target.id}`,
    body: () => ({ effectiveTo: '2024-01-20' }),
  },
  {
    name: 'update own profile',
    method: 'PATCH',
    allowed: roles,
    path: () => '/auth/me',
    body: () => ({ name: 'Updated own profile' }),
  },
  {
    name: 'change own password',
    method: 'PATCH',
    allowed: roles,
    path: () => '/auth/password',
    body: (_c, u) => ({
      currentPassword: u.password,
      newPassword: randomUUID() + randomUUID(),
    }),
  },
  {
    name: 'import preview',
    method: 'POST',
    allowed: operatorRoles,
    path: () => '/imports/preview',
    importStage: 'preview',
  },
  {
    name: 'import mapping',
    method: 'POST',
    allowed: operatorRoles,
    path: () => '',
    importStage: 'map',
  },
  {
    name: 'import confirmation',
    method: 'POST',
    allowed: operatorRoles,
    path: () => '',
    importStage: 'confirm',
  },
];

function upload(ctx: Context, unique: string) {
  const form = new FormData();
  form.set(
    'file',
    new Blob(
      [
        `date,impressions,clicks,reach,label\n2024-01-04,100,5,50,${ctx.suffix}-${unique}\n`,
      ],
      { type: 'text/csv' },
    ),
    'authorization.csv',
  );
  return form;
}

async function importRequest(
  action: Action,
  ctx: Context,
  user: (typeof users)[number],
) {
  const mapping = {
    mapping: {
      date: 'recordDate',
      impressions: 'SM_IMPRESSIONS',
      clicks: 'SM_LINK_CLICKS',
    },
    campaignId: ctx.campaign.id,
    platformId: ctx.dataPlatform.id,
  };
  const uploadHeaders = headers(users[0]);
  delete (uploadHeaders as Partial<typeof uploadHeaders>)['Content-Type'];
  const preview = await request('/imports/preview', {
    method: 'POST',
    headers: uploadHeaders,
    body: upload(ctx, randomUUID()),
  });
  if (preview.status !== 201) {
    const error = (await preview.json()) as { code?: string; message?: string };
    throw new Error(
      `Import preview failed: ${error.code ?? error.message ?? preview.status}`,
    );
  }
  const { id } = (await preview.json()) as { id: string };
  if (action.importStage === 'confirm') {
    const mapped = await request(`/imports/${id}/map`, {
      method: 'POST',
      headers: headers(users[0]),
      body: JSON.stringify(mapping),
    });
    expect(mapped.status).toBe(201);
  }
  const path = `/imports/${id}/${action.importStage}`;
  return {
    path,
    body: action.importStage === 'map' ? JSON.stringify(mapping) : undefined,
    user,
  };
}

describe('real HTTP authorization and mutation protection matrix', () => {
  beforeAll(async () => {
    await sql.connect();
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
    base = await app.getUrl();
    for (const role of roles) {
      const definition = await prisma.role.findUniqueOrThrow({
        where: { code: role },
      });
      const password = randomUUID() + randomUUID();
      const user = await prisma.user.create({
        data: {
          name: `${prefix} actor`,
          email: `${prefix}-${role}@example.invalid`.toLowerCase(),
          roleId: definition.id,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        },
      });
      users.push({
        id: user.id,
        role,
        roleId: definition.id,
        email: user.email,
        password,
        cookie: '',
        csrf: '',
      });
      await login(users.at(-1)!);
    }
  });

  afterAll(async () => {
    await app?.close();
    const fixtures = await prisma.user.findMany({
      where: {
        OR: [
          { id: { in: users.map((u) => u.id) } },
          { name: { startsWith: prefix } },
          { email: { startsWith: prefix } },
          { email: { startsWith: prefix.toLowerCase() } },
        ],
      },
      select: { id: true },
    });
    const ids = fixtures.map((u) => u.id);
    const campaigns = await prisma.campaign.findMany({
      where: { createdByUserId: { in: ids } },
      select: { id: true },
    });
    const campaignIds = campaigns.map((c) => c.id);
    const recordWhere = {
      campaignPlatform: {
        campaignChannel: { campaignId: { in: campaignIds } },
      },
    };
    await prisma.performanceMetricValue.deleteMany({
      where: { performanceRecord: recordWhere },
    });
    await prisma.performanceRecord.deleteMany({ where: recordWhere });
    await prisma.kpiTarget.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await prisma.campaignPlatform.deleteMany({
      where: { campaignChannel: { campaignId: { in: campaignIds } } },
    });
    await prisma.campaignChannel.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await prisma.importRow.deleteMany({
      where: { importBatch: { importedByUserId: { in: ids } } },
    });
    await prisma.importBatch.deleteMany({
      where: { importedByUserId: { in: ids } },
    });
    await prisma.platform.deleteMany({
      where: { code: { startsWith: prefix } },
    });
    await prisma.marketingChannel.deleteMany({
      where: { code: { startsWith: prefix } },
    });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.passwordRecoveryToken.deleteMany({
      where: { userId: { in: ids } },
    });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    await sql.end();
  });

  it.each(actions)(
    '$name enforces authentication, role, Origin and CSRF before writes',
    async (action) => {
      const ctx = await context();
      if (action.name === 'reactivate user')
        await prisma.user.update({
          where: { id: ctx.targetUser.id },
          data: { active: false, deactivatedAt: new Date() },
        });
      for (const user of users) {
        let path = action.path(ctx);
        let body: BodyInit | undefined = action.body
          ? JSON.stringify(action.body(ctx, user))
          : undefined;
        const requestHeaders: Record<string, string> = headers(user);
        if (action.importStage === 'preview') {
          body = upload(ctx, randomUUID());
          delete requestHeaders['Content-Type'];
        } else if (action.importStage) {
          const prepared = await importRequest(action, ctx, user);
          path = prepared.path;
          body = prepared.body;
        }
        const before = await fingerprint();
        const anonymous = await request(path, {
          method: action.method,
          headers: { Origin: origin },
          body,
        });
        expect(anonymous.status).toBe(401);
        expect(await fingerprint()).toBe(before);
        if (!action.allowed.includes(user.role)) {
          const denied = await request(path, {
            method: action.method,
            headers: requestHeaders,
            body,
          });
          expect(denied.status).toBe(403);
          expect(await fingerprint()).toBe(before);
          continue;
        }
        for (const protection of [
          'missing csrf',
          'wrong csrf',
          'missing origin',
          'wrong origin',
        ]) {
          const invalid = { ...requestHeaders };
          if (protection === 'missing csrf') delete invalid['x-csrf-token'];
          if (protection === 'wrong csrf') invalid['x-csrf-token'] = 'invalid';
          if (protection === 'missing origin') delete invalid.Origin;
          if (protection === 'wrong origin')
            invalid.Origin = 'https://attacker.invalid';
          const denied = await request(path, {
            method: action.method,
            headers: invalid,
            body,
          });
          expect(denied.status, protection).toBe(403);
          expect(await fingerprint(), protection).toBe(before);
        }
        const allowed = await request(path, {
          method: action.method,
          headers: requestHeaders,
          body,
        });
        if (allowed.status !== (action.method === 'POST' ? 201 : 200)) {
          const error = (await allowed.json()) as {
            code?: string;
            message?: string;
          };
          throw new Error(
            `${action.name} failed: ${error.code ?? error.message ?? allowed.status}`,
          );
        }
        expect(await fingerprint()).not.toBe(before);
        if (action.name === 'change own password') {
          expect(
            (await request('/auth/me', { headers: { Cookie: user.cookie } }))
              .status,
          ).toBe(401);
          user.password = JSON.parse(body as string).newPassword;
          await login(user);
        }
        // Import confirmation adds the date once; a later allowed role needs a
        // fresh context so duplicate handling cannot hide its authorization result.
        if (action.importStage === 'confirm') {
          await prisma.performanceMetricValue.deleteMany({
            where: {
              performanceRecord: {
                campaignPlatformId: ctx.campaignPlatformId,
                recordDate: new Date('2024-01-04'),
              },
            },
          });
          await prisma.performanceRecord.deleteMany({
            where: {
              campaignPlatformId: ctx.campaignPlatformId,
              recordDate: new Date('2024-01-04'),
            },
          });
        }
      }
    },
  );

  it('permits protected reads and PDF exports for all roles, restricts user administration reads, and revokes logout sessions', async () => {
    const readPaths = [
      '/auth/me',
      '/channels',
      '/platforms',
      '/campaigns',
      '/performance-records',
      '/targets',
      '/targets/definitions',
      '/imports',
      '/analytics/dashboard',
      '/reports/preview',
      '/reports/dashboard.pdf',
    ];
    for (const path of readPaths) {
      expect((await request(path)).status).toBe(401);
      for (const user of users)
        expect(
          (await request(path, { headers: { Cookie: user.cookie } })).status,
          `${path} ${user.role}`,
        ).toBe(200);
    }
    for (const path of ['/users', '/users/roles'])
      for (const user of users)
        expect(
          (await request(path, { headers: { Cookie: user.cookie } })).status,
        ).toBe(user.role === 'ADMIN' ? 200 : 403);
    for (const user of users) {
      expect(
        (
          await request('/auth/logout', {
            method: 'POST',
            headers: { ...headers(user), 'x-csrf-token': 'invalid' },
          })
        ).status,
      ).toBe(403);
      expect(
        (await request('/auth/me', { headers: { Cookie: user.cookie } }))
          .status,
      ).toBe(200);
      expect(
        (
          await request('/auth/logout', {
            method: 'POST',
            headers: headers(user),
          })
        ).status,
      ).toBe(201);
      expect(
        (await request('/auth/me', { headers: { Cookie: user.cookie } }))
          .status,
      ).toBe(401);
    }
  });
});
