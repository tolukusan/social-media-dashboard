import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';
import { ImportsService } from './imports.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let base: string;
const actors: Array<{ id: string; cookie: string; csrf: string }> = [];
const batchIds: string[] = [];
const campaignIds: string[] = [];
async function batch(
  status:
    | 'PREVIEW'
    | 'READY'
    | 'REJECTED'
    | 'FAILED'
    | 'COMPLETED'
    | 'IMPORTING' = 'PREVIEW',
) {
  const item = await prisma.importBatch.create({
    data: {
      importedByUserId: actors[0].id,
      originalFilename: 'deletion-fixture.csv',
      checksum: randomUUID(),
      status,
      rows: {
        create: {
          sourceRowNumber: 1,
          rawData: { Date: '2026-01-01', Views: 5 },
        },
      },
    },
  });
  batchIds.push(item.id);
  return item;
}
function remove(
  id: string,
  actor = actors[0],
  extra: Record<string, string> = {},
) {
  return fetch(`${base}/api/v1/imports/${id}`, {
    method: 'DELETE',
    headers: {
      Origin: origin,
      Cookie: actor.cookie,
      'x-csrf-token': actor.csrf,
      ...extra,
    },
  });
}
describe('import deletion HTTP and PostgreSQL boundaries', () => {
  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    for (const code of ['ADMIN', 'MARKETING_OFFICER', 'MANAGEMENT']) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code } });
      const password = randomUUID() + randomUUID();
      const user = await prisma.user.create({
        data: {
          name: 'Import deletion fixture',
          email: `delete-${randomUUID()}@example.test`,
          roleId: role.id,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        },
      });
      const csrf = await fetch(`${base}/api/v1/auth/csrf`);
      const token = (await csrf.json()).csrfToken;
      const login = await fetch(`${base}/api/v1/auth/login`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password }),
      });
      expect(login.status).toBe(201);
      actors.push({
        id: user.id,
        csrf: token,
        cookie: `${csrf.headers.get('set-cookie')?.match(/csrf_token=[^;]+/)?.[0]}; ${login.headers.get('set-cookie')?.match(/smd_session=[^;]+/)?.[0]}`,
      });
    }
  });
  afterAll(async () => {
    await app?.close();
    const ids = actors.map((a) => a.id);
    await prisma.performanceRecord.deleteMany({
      where: { importBatchId: { in: batchIds } },
    });
    await prisma.campaignPlatform.deleteMany({
      where: { campaignChannel: { campaignId: { in: campaignIds } } },
    });
    await prisma.campaignChannel.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await prisma.importRow.deleteMany({
      where: { importBatchId: { in: batchIds } },
    });
    await prisma.importBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
  it('rejects anonymous, Marketing Officer, and Management deletion without mutation', async () => {
    const item = await batch();
    expect((await remove(item.id, actors[0], { Cookie: '' })).status).toBe(401);
    for (const actor of actors.slice(1))
      expect((await remove(item.id, actor)).status).toBe(403);
    expect(
      await prisma.importRow.count({ where: { importBatchId: item.id } }),
    ).toBe(1);
  });
  it('requires CSRF and allowed Origin', async () => {
    const item = await batch();
    expect(
      (await remove(item.id, actors[0], { 'x-csrf-token': '' })).status,
    ).toBe(403);
    expect(
      (
        await remove(item.id, actors[0], {
          Origin: 'https://forbidden.example',
        })
      ).status,
    ).toBe(403);
    expect(
      await prisma.importBatch.findUnique({ where: { id: item.id } }),
    ).not.toBeNull();
  });
  it('deletes uncommitted batches and rows and records the acting Administrator', async () => {
    for (const status of ['PREVIEW', 'READY', 'REJECTED', 'FAILED'] as const) {
      const item = await batch(status);
      const response = await remove(item.id);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: item.id, deletedRows: 1 });
      expect(
        await prisma.importBatch.findUnique({ where: { id: item.id } }),
      ).toBeNull();
      expect(
        await prisma.importRow.count({ where: { importBatchId: item.id } }),
      ).toBe(0);
      expect(
        await prisma.auditLog.findFirst({
          where: {
            entityId: item.id,
            action: 'IMPORT_DELETED',
            actorUserId: actors[0].id,
          },
        }),
      ).not.toBeNull();
    }
  });
  it('retains completed and processing imports and their staged rows', async () => {
    for (const status of ['COMPLETED', 'IMPORTING'] as const) {
      const item = await batch(status);
      const response = await remove(item.id);
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('IMPORT_DELETE_PROTECTED');
      expect(
        await prisma.importRow.count({ where: { importBatchId: item.id } }),
      ).toBe(1);
    }
  });
  it('protects references from active and archived performance records', async () => {
    const platform = await prisma.platform.findFirstOrThrow({
      where: { active: true },
    });
    for (const status of ['ACTIVE', 'ARCHIVED'] as const) {
      const item = await batch();
      const campaign = await prisma.campaign.create({
        data: {
          name: 'Deletion reference fixture',
          startDate: new Date('2026-01-01'),
          responsibleUserId: actors[0].id,
          createdByUserId: actors[0].id,
          updatedByUserId: actors[0].id,
          campaignChannels: {
            create: {
              channelId: platform.channelId,
              campaignPlatforms: { create: { platformId: platform.id } },
            },
          },
        },
        include: { campaignChannels: { include: { campaignPlatforms: true } } },
      });
      campaignIds.push(campaign.id);
      const record = await prisma.performanceRecord.create({
        data: {
          campaignPlatformId:
            campaign.campaignChannels[0].campaignPlatforms[0].id,
          recordDate: new Date('2026-01-01'),
          createdByUserId: actors[0].id,
          updatedByUserId: actors[0].id,
          importBatchId: item.id,
          status,
        },
      });
      expect((await remove(item.id)).status).toBe(409);
      expect(
        await prisma.performanceRecord.findUnique({ where: { id: record.id } }),
      ).not.toBeNull();
    }
  });
  it('rolls back batch and row deletion when its audit write fails', async () => {
    const item = await batch();
    await expect(
      app.get(ImportsService).remove(item.id, randomUUID()),
    ).rejects.toThrow();
    expect(
      await prisma.importBatch.findUnique({ where: { id: item.id } }),
    ).not.toBeNull();
    expect(
      await prisma.importRow.count({ where: { importBatchId: item.id } }),
    ).toBe(1);
  });

  it('returns not found for missing or previously deleted imports', async () => {
    expect((await remove(randomUUID())).status).toBe(404);
    const item = await batch();
    expect((await remove(item.id)).status).toBe(200);
    expect((await remove(item.id)).status).toBe(404);
  });
});
