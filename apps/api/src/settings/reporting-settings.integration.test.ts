import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import argon2 from 'argon2';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let base: string;
let original: Awaited<ReturnType<typeof prisma.reportingSettings.findUnique>>;
const actors: Array<{
  id: string;
  role: string;
  cookie: string;
  csrf: string;
}> = [];

function request(path: string, init?: RequestInit) {
  return fetch(`${base}/api/v1${path}`, init);
}
function headers(actor = actors[0]) {
  return {
    Origin: origin,
    Cookie: actor.cookie,
    'x-csrf-token': actor.csrf,
    'Content-Type': 'application/json',
  };
}
function patch(
  body: unknown,
  actor = actors[0],
  extraHeaders = headers(actor),
) {
  return request('/settings/reporting', {
    method: 'PATCH',
    headers: extraHeaders,
    body: JSON.stringify(body),
  });
}
async function state() {
  return {
    settings: await prisma.reportingSettings.findMany(),
    audit: await prisma.auditLog.count(),
  };
}

describe('persisted reporting currency', () => {
  beforeAll(async () => {
    original = await prisma.reportingSettings.findUnique({
      where: { id: 'organisation' },
    });
    // The runner refuses all targets except a dedicated local test database.
    await prisma.reportingSettings.deleteMany();
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
    for (const roleCode of ['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT']) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: roleCode },
      });
      const email = `settings-${randomUUID()}@example.invalid`;
      const password = randomUUID() + randomUUID();
      const user = await prisma.user.create({
        data: {
          name: 'Reporting settings fixture',
          email,
          roleId: role.id,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        },
      });
      const actor = { id: user.id, role: roleCode, cookie: '', csrf: '' };
      actors.push(actor);
      const csrf = await request('/auth/csrf');
      actor.csrf = ((await csrf.json()) as { csrfToken: string }).csrfToken;
      const cookie = csrf.headers
        .get('set-cookie')
        ?.match(/csrf_token=[^;]+/)?.[0];
      const login = await request('/auth/login', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(login.status).toBe(201);
      const session = login.headers
        .get('set-cookie')
        ?.match(/smd_session=[^;]+/)?.[0];
      if (!cookie || !session) throw new Error('Fixture cookies unavailable.');
      actor.cookie = `${cookie}; ${session}`;
    }
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app?.close();
    const ids = actors.map(({ id }) => id);
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.reportingSettings.deleteMany();
    if (original) await prisma.reportingSettings.create({ data: original });
    await prisma.$disconnect();
  });

  it('denies anonymous access and exposes an unset value to authenticated readers', async () => {
    expect((await request('/settings/reporting')).status).toBe(401);
    expect(
      (
        await patch({ reportingCurrency: 'NGN' }, actors[0], {
          ...headers(),
          Cookie: '',
        })
      ).status,
    ).toBe(401);
    for (const actor of actors) {
      const result = await request('/settings/reporting', {
        headers: headers(actor),
      });
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({
        reportingCurrency: null,
        availableCurrencies: expect.arrayContaining(['NGN', 'USD']),
      });
    }
  });

  it('enforces Administrator, Origin, and CSRF without changing settings or audit', async () => {
    const before = await state();
    for (const actor of actors.slice(1))
      expect((await patch({ reportingCurrency: 'NGN' }, actor)).status).toBe(
        403,
      );
    expect(
      (
        await patch({ reportingCurrency: 'NGN' }, actors[0], {
          ...headers(),
          'x-csrf-token': '',
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await patch({ reportingCurrency: 'NGN' }, actors[0], {
          ...headers(),
          Origin: 'https://unapproved.example.invalid',
        })
      ).status,
    ).toBe(403);
    expect(await state()).toEqual(before);
  });

  it('rejects invalid, missing, null, lowercase, and unknown fields without writes', async () => {
    const before = await state();
    for (const body of [
      {},
      { reportingCurrency: null },
      { reportingCurrency: 'usd' },
      { reportingCurrency: 'ZZZ' },
      { reportingCurrency: 'USD', extra: 'ignored?' },
    ]) {
      expect((await patch(body)).status).toBe(400);
    }
    expect(await state()).toEqual(before);
  });

  it('persists the currency, ignores legacy environment configuration, and keeps filtered missing data and report values unchanged', async () => {
    vi.stubEnv('REPORTING_CURRENCY', 'EUR');
    const query = new URLSearchParams({
      campaignId: randomUUID(),
      from: '2024-01-01',
      to: '2024-01-02',
    });
    const readDashboard = async () =>
      (
        await request(`/analytics/dashboard?${query}`, {
          headers: headers(actors[2]),
        })
      ).json();
    const before = await readDashboard();
    expect(before.reportingContext.currencyCode).toBeNull();
    expect((await patch({ reportingCurrency: 'NGN' })).status).toBe(200);
    expect(
      (
        await prisma.reportingSettings.findUniqueOrThrow({
          where: { id: 'organisation' },
        })
      ).reportingCurrency,
    ).toBe('NGN');
    const after = await readDashboard();
    expect(after).toEqual({
      ...before,
      reportingContext: { ...before.reportingContext, currencyCode: 'NGN' },
    });
    const report = await request(`/reports/preview?${query}`, {
      headers: headers(actors[2]),
    });
    expect(report.status).toBe(200);
    expect(await report.json()).toMatchObject({
      reportingCurrency: 'NGN',
      reportingCurrencyConfigured: true,
      summary: { recordCount: 0 },
    });
    expect(
      await prisma.auditLog.findFirst({
        where: {
          actorUserId: actors[0].id,
          action: 'REPORTING_CURRENCY_CHANGED',
        },
      }),
    ).toMatchObject({
      metadata: { previousCurrency: null, reportingCurrency: 'NGN' },
    });
    vi.unstubAllEnvs();
  });

  it('changes labels without converting raw metrics, campaign budgets, or KPI targets', async () => {
    const amounts = async () => ({
      raw: await prisma.performanceMetricValue.findMany({
        orderBy: { id: 'asc' },
      }),
      budgets: await prisma.campaign.findMany({
        select: { id: true, budget: true },
        orderBy: { id: 'asc' },
      }),
      targets: await prisma.kpiTarget.findMany({ orderBy: { id: 'asc' } }),
    });
    const before = await amounts();
    expect((await patch({ reportingCurrency: 'USD' })).status).toBe(200);
    expect(await amounts()).toEqual(before);
    const result = await request('/analytics/dashboard', {
      headers: headers(),
    });
    expect((await result.json()).reportingContext.currencyCode).toBe('USD');
  });

  it('enforces database singleton and currency format constraints', async () => {
    await expect(
      prisma.reportingSettings.create({
        data: { id: 'second-organisation', reportingCurrency: 'USD' },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.reportingSettings.update({
        where: { id: 'organisation' },
        data: { reportingCurrency: 'usd' },
      }),
    ).rejects.toThrow();
  });
});
