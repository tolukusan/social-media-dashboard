import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, test, expect } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import argon2 from 'argon2';
import { AppModule } from '../app.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { AccessService } from './access.service.js';
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let db: PrismaService;
let access: AccessService;
let admin: string;
let manager: string;
let roleId: string;
let base: string;
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const password = randomUUID() + randomUUID();
let pendingEmail: string;
let applicantPassword: string;
let adminCount: number;
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
  base = await app.getUrl();
  db = app.get(PrismaService);
  access = app.get(AccessService);
  const roles = await db.role.findMany();
  roleId = roles.find((r) => r.code === 'MANAGEMENT')!.id;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  admin = (
    await db.user.create({
      data: {
        name: 'Access administrator',
        email: `${randomUUID()}@example.invalid`,
        passwordHash: hash,
        roleId: roles.find((r) => r.code === 'ADMIN')!.id,
      },
    })
  ).id;
  manager = (
    await db.user.create({
      data: {
        name: 'Access manager',
        email: `${randomUUID()}@example.invalid`,
        passwordHash: hash,
        roleId,
      },
    })
  ).id;
  adminCount = await db.user.count({ where: { role: { code: 'ADMIN' } } });
});
afterAll(async () => {
  await app.close();
});
async function browser(
  path: string,
  method = 'GET',
  body?: unknown,
  session = '',
) {
  const csrf = await fetch(`${base}/api/v1/auth/csrf`);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  return fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: `csrf_token=${csrfToken}; ${session}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function session(id: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id } });
  const response = await browser('/auth/login', 'POST', {
    email: user.email,
    password,
  });
  expect(response.status).toBe(201);
  return response.headers.get('set-cookie')!.match(/smd_session=[^;]+/)![0];
}
test('public registration has generic acknowledgements, no first-admin bootstrap, no session and no workspace access', async () => {
  pendingEmail = `${randomUUID()}@example.invalid`;
  const responses = await Promise.all([
    access.register(
      { email: pendingEmail, name: 'Applicant', password },
      'registration-one',
    ),
    access.register(
      {
        email: pendingEmail,
        name: 'Other name',
        password: 'different-passphrase',
      },
      'registration-two',
    ),
  ]);
  expect(responses[0]).toEqual(responses[1]);
  const stored = await db.registrationRequest.findUniqueOrThrow({
    where: { email: pendingEmail },
  });
  applicantPassword = (await argon2.verify(stored.passwordHash!, password))
    ? password
    : 'different-passphrase';
  expect(await argon2.verify(stored.passwordHash!, applicantPassword)).toBe(
    true,
  );
  expect(
    await db.registrationRequest.count({ where: { email: pendingEmail } }),
  ).toBe(1);
  expect(await db.user.count({ where: { email: pendingEmail } })).toBe(0);
  const login = await browser('/auth/login', 'POST', {
    email: pendingEmail,
    password,
  });
  expect(login.status).toBe(401);
  expect(login.headers.get('set-cookie')).toBeNull();
  expect((await browser('/campaigns')).status).toBe(401);
  const badCsrf = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: { Origin: origin, 'content-type': 'application/json' },
    body: JSON.stringify({ email: pendingEmail, name: 'Applicant', password }),
  });
  expect(badCsrf.status).toBe(403);
  const badOrigin = await fetch(`${base}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      Origin: 'https://invalid.example',
      'content-type': 'application/json',
      'x-csrf-token': 'fixture',
      Cookie: 'csrf_token=fixture',
    },
    body: JSON.stringify({ email: pendingEmail, name: 'Applicant', password }),
  });
  expect(badOrigin.status).toBe(403);
  expect(await db.user.count({ where: { role: { code: 'ADMIN' } } })).toBe(
    adminCount,
  );
});
test('only Administrator can review; approval assigns selected existing role and rejection never creates a user', async () => {
  const request = await db.registrationRequest.findUniqueOrThrow({
    where: { email: pendingEmail },
  });
  expect(
    (
      await browser(
        '/access/requests',
        'GET',
        undefined,
        await session(manager),
      )
    ).status,
  ).toBe(403);
  await expect(
    access.review(request.id, { decision: 'APPROVED', roleId }, manager),
  ).rejects.toThrow('Administrator');
  await expect(
    access.review(request.id, { decision: 'APPROVED' }, admin),
  ).rejects.toThrow('role');
  await access.review(request.id, { decision: 'APPROVED', roleId }, admin);
  const user = await db.user.findUniqueOrThrow({
    where: { email: pendingEmail },
    include: { role: true },
  });
  expect(user.role.code).toBe('MANAGEMENT');
  expect(await argon2.verify(user.passwordHash, applicantPassword)).toBe(true);
  expect(
    (
      await browser('/auth/login', 'POST', {
        email: pendingEmail,
        password: applicantPassword,
      })
    ).status,
  ).toBe(201);
  const listing = await browser(
    '/access/requests',
    'GET',
    undefined,
    await session(admin),
  );
  expect(listing.status).toBe(200);
  expect(await listing.text()).not.toMatch(/passwordHash|tokenHash/);
  await expect(
    access.review(request.id, { decision: 'REJECTED' }, admin),
  ).rejects.toThrow('resolved');
  const email = `${randomUUID()}@example.invalid`;
  await access.register(
    { email, name: 'Rejected applicant', password },
    'reject-ip',
  );
  const rejected = await db.registrationRequest.findUniqueOrThrow({
    where: { email },
  });
  await access.review(rejected.id, { decision: 'REJECTED' }, admin);
  expect(
    (await browser('/auth/login', 'POST', { email, password })).status,
  ).toBe(401);
  expect(await db.user.count({ where: { email } })).toBe(0);
});
test('invitations bind email/role, prevent existing or pending takeover, expire, revoke and accept exactly once', async () => {
  await expect(
    access.invite({ email: pendingEmail, roleId }, admin),
  ).rejects.toThrow('account');
  const pending = `${randomUUID()}@example.invalid`;
  await access.register(
    { email: pending, name: 'Pending', password },
    'pending-ip',
  );
  await expect(
    access.invite({ email: pending, roleId }, admin),
  ).rejects.toThrow('pending');
  const email = `${randomUUID()}@example.invalid`;
  const invitation = await access.invite({ email, roleId }, admin);
  const token = new URLSearchParams(
    new URL(invitation.invitationUrl).hash.slice(1),
  ).get('token')!;
  expect(JSON.stringify(await access.invitations())).not.toContain(token);
  expect(
    (
      await db.userInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      })
    ).tokenHash,
  ).not.toBe(token);
  await expect(
    access.accept(
      {
        email: `${randomUUID()}@example.invalid`,
        name: 'Wrong recipient',
        password,
        token,
      },
      'wrong-ip',
    ),
  ).rejects.toThrow('invalid');
  const results = await Promise.allSettled([
    access.accept({ email, name: 'Invited', password, token }, 'invite-one'),
    access.accept({ email, name: 'Invited', password, token }, 'invite-two'),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(await db.user.count({ where: { email, roleId } })).toBe(1);
  await expect(
    access.accept({ email, name: 'Replay', password, token }, 'replay-ip'),
  ).rejects.toThrow('invalid');
  const second = await access.invite(
    { email: `${randomUUID()}@example.invalid`, roleId },
    admin,
  );
  const secondToken = new URLSearchParams(
    new URL(second.invitationUrl).hash.slice(1),
  ).get('token')!;
  await access.revoke(second.id, admin);
  await expect(
    access.accept(
      { email: second.email, name: 'Revoked', password, token: secondToken },
      'revoked-ip',
    ),
  ).rejects.toThrow('invalid');
  const third = await access.invite(
    { email: `${randomUUID()}@example.invalid`, roleId },
    admin,
  );
  const thirdToken = new URLSearchParams(
    new URL(third.invitationUrl).hash.slice(1),
  ).get('token')!;
  await db.userInvitation.update({
    where: { id: third.id },
    data: { expiresAt: new Date(0) },
  });
  await expect(
    access.accept(
      { email: third.email, name: 'Expired', password, token: thirdToken },
      'expired-ip',
    ),
  ).rejects.toThrow('expired');
});

test('Archive and access administration enforce HTTP roles and public acceptance is throttled', async () => {
  expect((await browser('/archive/campaigns')).status).toBe(401);
  expect(
    (
      await browser(
        '/archive/records',
        'GET',
        undefined,
        await session(manager),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await browser(
        '/archive/campaigns',
        'GET',
        undefined,
        await session(admin),
      )
    ).status,
  ).toBe(200);
  const email = `${randomUUID()}@example.invalid`;
  for (let n = 0; n < 10; n++)
    await expect(
      access.accept(
        {
          email,
          name: 'Invalid token fixture',
          password,
          token: 'x'.repeat(43),
        },
        'rate-ip',
      ),
    ).rejects.toThrow('invalid');
  await expect(
    access.accept(
      { email, name: 'Throttled', password, token: 'x'.repeat(43) },
      'rate-ip',
    ),
  ).rejects.toThrow('try again later');
});
