import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, it } from 'vitest';
import argon2 from 'argon2';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';
import { MailDeliveryService } from './mail-delivery.service.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required.');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let baseUrl: string;
const fixtures: Array<{ id: string; email: string; password: string }> = [];

async function createUser(roleCode: string, active = true) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });
  const email = `recovery-${randomUUID()}@example.invalid`;
  const password = `Original-${randomUUID()}-Password`;
  const user = await prisma.user.create({
    data: {
      name: 'Recovery Integration Fixture',
      email,
      roleId: role.id,
      active,
      deactivatedAt: active ? null : new Date(),
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });
  fixtures.push({ id: user.id, email, password });
  return fixtures.at(-1)!;
}

async function csrf() {
  const response = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  const value = (await response.json()) as { csrfToken: string };
  const cookie = response.headers
    .get('set-cookie')
    ?.match(/csrf_token=[^;]+/)?.[0];
  if (!cookie) throw new Error('CSRF cookie was not issued.');
  return { cookie, token: value.csrfToken };
}

async function recoveryRequest(
  email: string,
  security: Awaited<ReturnType<typeof csrf>>,
  requestOrigin = origin,
) {
  return fetch(`${baseUrl}/api/v1/auth/forgot-password`, {
    method: 'POST',
    headers: {
      origin: requestOrigin,
      cookie: security.cookie,
      'content-type': 'application/json',
      'x-csrf-token': security.token,
    },
    body: JSON.stringify({ email }),
  });
}

async function reset(
  token: string,
  security: Awaited<ReturnType<typeof csrf>>,
  requestOrigin = origin,
  includeCsrf = true,
) {
  return fetch(`${baseUrl}/api/v1/auth/reset-password`, {
    method: 'POST',
    headers: {
      origin: requestOrigin,
      ...(includeCsrf
        ? { cookie: security.cookie, 'x-csrf-token': security.token }
        : {}),
      'content-type': 'application/json',
    },
    body: JSON.stringify({ token, password: 'Replacement-Passphrase-2026' }),
  });
}

async function waitForMail(index: number) {
  const mail = app.get(MailDeliveryService);
  for (
    let attempt = 0;
    attempt < 30 && mail.capturedForVerification().length <= index;
    attempt++
  )
    await new Promise((resolve) => setTimeout(resolve, 10));
  const item = mail.capturedForVerification()[index];
  if (!item)
    throw new Error(
      'The test mail adapter did not capture the recovery message.',
    );
  return new URLSearchParams(new URL(item.url).hash.slice(1)).get('token')!;
}

describe('password recovery HTTP and PostgreSQL flow', () => {
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
    app.get(MailDeliveryService).enableCaptureForVerification();
  });

  afterAll(async () => {
    await app?.close();
    if (fixtures.length) {
      const ids = fixtures.map(({ id }) => id);
      await prisma.passwordRecoveryToken.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorUserId: { in: ids } }, { entityId: { in: ids } }],
        },
      });
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });

  it('keeps acknowledgements generic, rejects missing/disallowed Origin and CSRF, then atomically redeems once', async () => {
    const users = await Promise.all([
      createUser('ADMIN'),
      createUser('MARKETING_OFFICER'),
      createUser('MANAGEMENT'),
    ]);
    const inactive = await createUser('MANAGEMENT', false);
    const security = await csrf();
    const captured = app.get(MailDeliveryService).capturedForVerification();
    const first = await recoveryRequest(users[1].email, security);
    if (
      first.status !== 202 ||
      first.headers.get('cache-control') !== 'no-store'
    )
      throw new Error(
        'An eligible recovery request did not return the generic no-store acknowledgement.',
      );
    const unknown = await recoveryRequest(
      `missing-${randomUUID()}@example.invalid`,
      security,
    );
    if (
      unknown.status !== 202 ||
      (await unknown.json()).message !== (await first.clone().json()).message
    )
      throw new Error('Existing and missing account acknowledgements differ.');
    const inactiveResponse = await recoveryRequest(inactive.email, security);
    if (
      inactiveResponse.status !== 202 ||
      (await inactiveResponse.json()).message !==
        (await first.clone().json()).message
    )
      throw new Error(
        'Inactive accounts were disclosed by the acknowledgement.',
      );
    for (const activeUser of [users[0], users[2]]) {
      const index = captured.length;
      const response = await recoveryRequest(activeUser.email, security);
      if (response.status !== 202)
        throw new Error('An active role could not request recovery.');
      await waitForMail(index);
      if (captured[index]?.to !== activeUser.email)
        throw new Error(
          'A recovery email was not addressed to the account email.',
        );
    }

    const missingOrigin = await fetch(
      `${baseUrl}/api/v1/auth/forgot-password`,
      {
        method: 'POST',
        headers: {
          cookie: security.cookie,
          'content-type': 'application/json',
          'x-csrf-token': security.token,
        },
        body: JSON.stringify({ email: users[0].email }),
      },
    );
    if (missingOrigin.status !== 403)
      throw new Error('Missing Origin was accepted.');
    const wrongOrigin = await recoveryRequest(
      users[0].email,
      security,
      'https://attacker.invalid',
    );
    if (wrongOrigin.status !== 403)
      throw new Error('Disallowed Origin was accepted.');
    const missingCsrf = await reset('A'.repeat(43), security, origin, false);
    if (missingCsrf.status !== 403)
      throw new Error('Recovery accepted a missing CSRF token.');
    const beforeCapture = captured.length;
    const accepted = await recoveryRequest(users[1].email, security);
    if (accepted.status !== 202)
      throw new Error('Allowed Origin recovery request was rejected.');
    const firstToken = await waitForMail(beforeCapture);
    const secondMailIndex = captured.length;
    const replacement = await recoveryRequest(users[1].email, security);
    if (replacement.status !== 202)
      throw new Error('Replacement recovery request failed.');
    const secondToken = await waitForMail(secondMailIndex);
    const expiryIndex = captured.length;
    const expiryRequest = await recoveryRequest(users[0].email, security);
    if (expiryRequest.status !== 202)
      throw new Error('Expiry fixture request failed.');
    const expiryToken = await waitForMail(expiryIndex);
    await prisma.passwordRecoveryToken.update({
      where: {
        tokenHash: createHash('sha256').update(expiryToken).digest('hex'),
      },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    const expired = await reset(expiryToken, security);
    if (expired.status !== 400)
      throw new Error('An expired reset link was accepted.');
    const oldLink = await reset(firstToken, security);
    if (oldLink.status !== 400)
      throw new Error('A replaced reset link remained usable.');

    const sessionToken = randomUUID() + randomUUID();
    await prisma.session.create({
      data: {
        userId: users[1].id,
        tokenHash: createHash('sha256').update(sessionToken).digest('hex'),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const attempts = await Promise.all([
      reset(secondToken, security),
      reset(secondToken, security),
    ]);
    if (
      attempts.filter((response) => response.status === 200).length !== 1 ||
      attempts.filter((response) => response.status === 400).length !== 1
    )
      throw new Error(
        'Concurrent redemption did not result in exactly one success.',
      );
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: users[1].id },
    });
    if (
      !(await argon2.verify(
        stored.passwordHash,
        'Replacement-Passphrase-2026',
      )) ||
      stored.email !== users[1].email ||
      stored.roleId !==
        (
          await prisma.role.findUniqueOrThrow({
            where: { code: 'MARKETING_OFFICER' },
          })
        ).id
    )
      throw new Error('Recovery did not only update the password.');
    const sessions = await prisma.session.findMany({
      where: { userId: users[1].id, revokedAt: null },
    });
    if (sessions.length)
      throw new Error('Recovery left an active session behind.');
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: users[1].id, action: 'PASSWORD_RECOVERY_COMPLETED' },
    });
    if (!audit) throw new Error('Successful recovery was not audited.');
    const reused = await reset(secondToken, security);
    if (reused.status !== 400)
      throw new Error('A successfully used reset link was accepted again.');

    const replacementLogin = JSON.stringify({
      email: users[1].email,
      password: 'Replacement-Passphrase-2026',
    });
    const loginWithoutOrigin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: replacementLogin,
    });
    if (loginWithoutOrigin.status !== 403)
      throw new Error('Login accepted a missing Origin.');
    const loginWithWrongOrigin = await fetch(
      `${baseUrl}/api/v1/auth/login`,
      {
        method: 'POST',
        headers: {
          origin: 'https://attacker.invalid',
          'content-type': 'application/json',
        },
        body: replacementLogin,
      },
    );
    if (loginWithWrongOrigin.status !== 403)
      throw new Error('Login accepted a disallowed Origin.');

    const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: replacementLogin,
    });
    if (login.status !== 201)
      throw new Error('The new password did not allow sign-in.');
    const rejectedOldLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({
        email: users[1].email,
        password: users[1].password,
      }),
    });
    if (rejectedOldLogin.status !== 401)
      throw new Error('The previous password still allowed sign-in.');
  });
});
