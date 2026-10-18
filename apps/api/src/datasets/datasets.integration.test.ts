import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import ExcelJS from 'exceljs';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';
import { DeletionService } from '../archive/deletion.service.js';

type RoleCode = 'ADMIN' | 'MARKETING_OFFICER' | 'MANAGEMENT';
type Actor = {
  id: string;
  email: string;
  role: RoleCode;
  cookie: string;
  csrf: string;
};

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});
const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
const actors: Actor[] = [];
const campaignIds: string[] = [];
const attemptIds: string[] = [];
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let base: string;

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${base}/api/v1${path}`, init);
}

function headers(actor: Actor, json = true) {
  return {
    Origin: origin,
    Cookie: actor.cookie,
    'x-csrf-token': actor.csrf,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function createCampaign(actor: Actor, name: string) {
  const response = await request('/campaigns', {
    method: 'POST',
    headers: headers(actor),
    body: JSON.stringify({
      name,
      startDate: '2026-01-01',
      responsibleUserId: actor.id,
      channels: [],
    }),
  });
  expect(response.status).toBe(201);
  const campaign = (await response.json()) as { id: string };
  campaignIds.push(campaign.id);
  return campaign.id;
}

async function preview(
  actor: Actor,
  campaignId: string,
  content: string | Buffer,
  filename = 'export.csv',
  datasetId?: string,
) {
  const form = new FormData();
  form.set('campaignId', campaignId);
  if (datasetId) form.set('datasetId', datasetId);
  const type = filename.endsWith('.xlsx')
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : filename.endsWith('.json')
      ? 'application/json'
      : 'text/csv';
  const fileContents: BlobPart =
    typeof content === 'string'
      ? content
      : (() => {
          const bytes = new Uint8Array(content.byteLength);
          bytes.set(content);
          return bytes;
        })();
  form.set('file', new Blob([fileContents], { type }), filename);
  const response = await request('/datasets/imports/preview', {
    method: 'POST',
    headers: headers(actor, false),
    body: form,
  });
  const result = (await response.json()) as {
    id?: string;
    duplicate?: { dataset?: { id?: string }; actions?: { replace?: boolean } };
    sheets?: Array<{ key: string; name: string; rowCount: number }>;
  };
  if (result.id) attemptIds.push(result.id);
  return { response, result };
}

async function confirm(actor: Actor, attemptId: string) {
  const response = await request(`/datasets/imports/${attemptId}/confirm`, {
    method: 'POST',
    headers: headers(actor),
    body: JSON.stringify({}),
  });
  return { response, result: await response.json() };
}

async function setSheet(actor: Actor, attemptId: string, sheet: string) {
  const response = await request(`/datasets/imports/${attemptId}/sheet`, {
    method: 'POST',
    headers: headers(actor),
    body: JSON.stringify({ selectedSheet: sheet }),
  });
  return { response, result: await response.json() };
}

describe('file-first dataset lifecycle and ownership', () => {
  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
    for (const roleCode of [
      'ADMIN',
      'MARKETING_OFFICER',
      'MANAGEMENT',
    ] as const) {
      const role = await prisma.role.findUniqueOrThrow({
        where: { code: roleCode },
      });
      const password = randomUUID() + randomUUID();
      const email = `dataset-${randomUUID()}@example.test`;
      const user = await prisma.user.create({
        data: {
          name: 'Dataset fixture',
          email,
          roleId: role.id,
          passwordHash: await argon2.hash(password, {
            type: argon2.argon2id,
          }),
        },
      });
      const csrfResponse = await request('/auth/csrf');
      const csrf = (await csrfResponse.json()).csrfToken as string;
      const login = await request('/auth/login', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(login.status).toBe(201);
      actors.push({
        id: user.id,
        email,
        role: roleCode,
        csrf,
        cookie: `${csrfResponse.headers.get('set-cookie')?.match(/csrf_token=[^;]+/)?.[0]}; ${login.headers.get('set-cookie')?.match(/smd_session=[^;]+/)?.[0]}`,
      });
    }
  });

  afterAll(async () => {
    await app?.close();
    const actorIds = actors.map((actor) => actor.id);
    await prisma.dataset.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await prisma.datasetImportTemplate.deleteMany({
      where: { createdByUserId: { in: actorIds } },
    });
    await prisma.importRow.deleteMany({
      where: { importBatchId: { in: attemptIds } },
    });
    await prisma.datasetRevision.deleteMany({
      where: { importBatchId: { in: attemptIds } },
    });
    await prisma.importBatch.deleteMany({ where: { id: { in: attemptIds } } });
    await prisma.datasetDeletionFence.deleteMany({
      where: { campaignId: { in: campaignIds } },
    });
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: actorIds } },
    });
    await prisma.campaign.deleteMany({ where: { id: { in: campaignIds } } });
    await prisma.session.deleteMany({ where: { userId: { in: actorIds } } });
    await prisma.user.deleteMany({ where: { id: { in: actorIds } } });
    await prisma.$disconnect();
  });

  it('imports an arbitrary table once, filters rows server-side, and finds duplicates by campaign and exact content', async () => {
    const admin = actors[0]!;
    const campaignId = await createCampaign(admin, 'Dataset campaign');
    const otherCampaignId = await createCampaign(
      admin,
      'Other dataset campaign',
    );
    const content =
      'Date,Clicks,Identifier\n2026-01-01,0,0012\n2026-01-02,-2.5,0013\n';
    const created = await preview(admin, campaignId, content);
    expect(created.response.status).toBe(201);
    expect(created.result.sheets?.[0]?.rowCount).toBe(2);
    const imported = await confirm(admin, created.result.id!);
    expect(imported.response.status).toBe(201);
    const dataset = imported.result as {
      id: string;
      currentRevision: number;
      rowCount: number;
      columns: Array<{ type: string }>;
    };
    expect(dataset.rowCount).toBe(2);
    expect(dataset.columns.map((column) => column.type)).toEqual([
      'date',
      'number',
      'text',
    ]);
    expect(
      await prisma.performanceRecord.count({
        where: { campaignPlatform: { campaignChannel: { campaignId } } },
      }),
    ).toBe(0);

    const sameBytesDifferentName = await preview(
      admin,
      campaignId,
      content,
      'renamed.csv',
    );
    expect(sameBytesDifferentName.result.duplicate?.dataset?.id).toBe(
      dataset.id,
    );
    expect(sameBytesDifferentName.result.duplicate?.actions?.replace).toBe(
      true,
    );

    const otherCampaign = await preview(admin, otherCampaignId, content);
    expect(otherCampaign.result.duplicate).toBeNull();
    expect(
      (await confirm(admin, otherCampaign.result.id!)).response.status,
    ).toBe(201);

    const overlappingButDifferent = await preview(
      admin,
      campaignId,
      content.replace('-2.5', '-2.6'),
    );
    expect(overlappingButDifferent.result.duplicate).toBeNull();
    expect(
      (await confirm(admin, overlappingButDifferent.result.id!)).response
        .status,
    ).toBe(201);

    const rowsResponse = await request(
      `/datasets/${dataset.id}/rows?page=1&pageSize=1&dateColumnId=c1&from=2026-01-02`,
      { headers: headers(admin, false) },
    );
    expect(rowsResponse.status).toBe(200);
    const page = (await rowsResponse.json()) as {
      page: number;
      pageSize: number;
      totalRows: number;
      rows: Array<{ cells: unknown[] }>;
    };
    expect(page.page).toBe(1);
    expect(typeof page.page).toBe('number');
    expect(page.pageSize).toBe(1);
    expect(page.totalRows).toBe(1);
    expect(page.rows[0]?.cells[1]).toBe('-2.5');
    expect(
      (
        await request(
          `/datasets/${dataset.id}/rows?expectedRevision=${dataset.currentRevision}`,
          { headers: headers(admin, false) },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/datasets/${dataset.id}/rows?expectedRevision=${dataset.currentRevision + 1}`,
          { headers: headers(admin, false) },
        )
      ).status,
    ).toBe(409);
  });

  it('keeps workbook worksheets independent and requires a choice when more than one has data', async () => {
    const admin = actors[0]!;
    const campaignId = await createCampaign(admin, 'Worksheet campaign');
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Organic').addRows([
      ['Day', 'Reach'],
      ['2026-02-01', 5],
    ]);
    workbook.addWorksheet('Paid').addRows([
      ['Day', 'Cost'],
      ['2026-02-01', 9],
    ]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const upload = await preview(admin, campaignId, buffer, 'campaign.xlsx');
    expect(upload.result.sheets).toEqual([
      { key: 'Organic', name: 'Organic', rowCount: 1 },
      { key: 'Paid', name: 'Paid', rowCount: 1 },
    ]);
    expect((await confirm(admin, upload.result.id!)).response.status).toBe(409);
    const selected = await setSheet(admin, upload.result.id!, 'Paid');
    expect(selected.response.status).toBe(201);
    const paid = await confirm(admin, upload.result.id!);
    expect(paid.response.status).toBe(201);
    const paidDataset = paid.result as {
      worksheetName: string;
      rowCount: number;
    };
    expect(paidDataset.worksheetName).toBe('Paid');
    expect(paidDataset.rowCount).toBe(1);

    const siblingUpload = await preview(
      admin,
      campaignId,
      buffer,
      'campaign.xlsx',
    );
    const organicSelection = await setSheet(
      admin,
      siblingUpload.result.id!,
      'Organic',
    );
    expect(organicSelection.response.status).toBe(201);
    const organic = await confirm(admin, siblingUpload.result.id!);
    expect(organic.response.status).toBe(201);
    expect((organic.result as { id: string }).id).not.toBe(
      (paid.result as { id: string }).id,
    );
  });

  it('allows confirmed replacement by Marketing Officers and preserves old content when replacement is empty', async () => {
    const admin = actors[0]!;
    const officer = actors[1]!;
    const campaignId = await createCampaign(admin, 'Replacement campaign');
    const created = await preview(admin, campaignId, 'Metric\n1\n');
    const original = await confirm(admin, created.result.id!);
    const originalDataset = original.result as {
      id: string;
      currentRevision: number;
    };

    const emptyReplacement = await preview(
      officer,
      campaignId,
      'Metric\n',
      'empty.csv',
      originalDataset.id,
    );
    const empty = await confirm(officer, emptyReplacement.result.id!);
    expect(empty.response.status).toBe(400);
    const unchanged = await prisma.dataset.findUniqueOrThrow({
      where: { id: originalDataset.id },
    });
    expect(unchanged.currentRevision).toBe(1);

    const replacement = await preview(
      officer,
      campaignId,
      'Metric\n2\n',
      'corrected.csv',
      originalDataset.id,
    );
    const replaced = await confirm(officer, replacement.result.id!);
    expect(replaced.response.status).toBe(201);
    expect((replaced.result as { id: string }).id).toBe(originalDataset.id);
    expect(
      (replaced.result as { currentRevision: number }).currentRevision,
    ).toBe(2);
    expect(
      await prisma.datasetRevision.count({
        where: { datasetId: originalDataset.id },
      }),
    ).toBe(2);
  });

  it('blocks management writes, preserves deletion fences, and permits fresh reimport after deletion', async () => {
    const admin = actors[0]!;
    const officer = actors[1]!;
    const management = actors[2]!;
    const campaignId = await createCampaign(admin, 'Delete campaign');
    const content = 'Value\n1\n';
    const created = await preview(admin, campaignId, content);
    const imported = await confirm(admin, created.result.id!);
    const dataset = imported.result as { id: string };

    expect(
      (await preview(management, campaignId, content)).response.status,
    ).toBe(403);
    expect(
      (
        await request(`/datasets/${dataset.id}`, {
          method: 'DELETE',
          headers: headers(officer, false),
        })
      ).status,
    ).toBe(403);

    const stale = await preview(officer, campaignId, content);
    expect(stale.result.duplicate?.dataset?.id).toBe(dataset.id);
    const removed = await request(`/datasets/${dataset.id}`, {
      method: 'DELETE',
      headers: headers(admin, false),
    });
    expect(removed.status).toBe(200);
    const staleConfirmation = await confirm(officer, stale.result.id!);
    expect(staleConfirmation.response.status).toBe(409);
    expect((staleConfirmation.result as { code: string }).code).toBe(
      'DATASET_ATTEMPT_STALE',
    );
    expect(
      await prisma.dataset.findUnique({ where: { id: dataset.id } }),
    ).toBeNull();

    const fresh = await preview(admin, campaignId, content);
    expect(fresh.result.duplicate).toBeNull();
    const reimport = await confirm(admin, fresh.result.id!);
    expect(reimport.response.status).toBe(201);
    expect((reimport.result as { id: string }).id).not.toBe(dataset.id);
    expect(
      await prisma.datasetDeletionFence.count({
        where: {
          campaignId,
          sourceChecksum: (
            await prisma.importBatch.findUniqueOrThrow({
              where: { id: created.result.id! },
              select: { checksum: true },
            })
          ).checksum,
          worksheetKey: 'single',
        },
      }),
    ).toBe(1);
  });

  it('allows explicitly selected numeric columns and only enables shared charts for matching meaning, unit, and interval', async () => {
    const admin = actors[0]!;
    const campaignId = await createCampaign(admin, 'Comparison campaign');
    const leftUpload = await preview(
      admin,
      campaignId,
      'Date,Impressions\n2026-05-01,10\n2026-05-02,12\n',
      'left.csv',
    );
    const left = (await confirm(admin, leftUpload.result.id!)).result as {
      id: string;
    };
    const rightUpload = await preview(
      admin,
      campaignId,
      'Date,Views\n2026-05-01,5\n2026-05-02,6\n',
      'right.csv',
    );
    const right = (await confirm(admin, rightUpload.result.id!)).result as {
      id: string;
    };

    for (const [datasetId, label] of [
      [left.id, 'Impressions'],
      [right.id, 'Views'],
    ]) {
      const update = await request(`/datasets/${datasetId}/columns`, {
        method: 'PATCH',
        headers: headers(admin),
        body: JSON.stringify({
          columns: [
            { id: 'c1', label: 'Date' },
            {
              id: 'c2',
              label,
              meaning: 'post impressions',
              unit: 'count',
            },
          ],
        }),
      });
      expect(update.status).toBe(200);
      const updatedDataset = (await update.json()) as {
        campaign: { id: string; name: string };
      };
      expect(updatedDataset.campaign.id).toBe(campaignId);
    }

    const same = await request('/datasets/compare/compatibility', {
      method: 'POST',
      headers: headers(admin),
      body: JSON.stringify({
        leftDatasetId: left.id,
        leftColumnId: 'c2',
        leftDateColumnId: 'c1',
        rightDatasetId: right.id,
        rightColumnId: 'c2',
        rightDateColumnId: 'c1',
      }),
    });
    expect(same.status).toBe(201);
    const compatible = (await same.json()) as {
      chart: { eligible: boolean; intervalMilliseconds: number };
    };
    expect(compatible.chart).toEqual({
      eligible: true,
      reason: null,
      intervalMilliseconds: 86_400_000,
    });

    const differentUnit = await request(`/datasets/${right.id}/columns`, {
      method: 'PATCH',
      headers: headers(admin),
      body: JSON.stringify({
        columns: [
          { id: 'c1', label: 'Date' },
          {
            id: 'c2',
            label: 'Views',
            meaning: 'post impressions',
            unit: 'views',
          },
        ],
      }),
    });
    expect(differentUnit.status).toBe(200);
    const incompatibleResponse = await request(
      '/datasets/compare/compatibility',
      {
        method: 'POST',
        headers: headers(admin),
        body: JSON.stringify({
          leftDatasetId: left.id,
          leftColumnId: 'c2',
          leftDateColumnId: 'c1',
          rightDatasetId: right.id,
          rightColumnId: 'c2',
          rightDateColumnId: 'c1',
        }),
      },
    );
    const incompatible = (await incompatibleResponse.json()) as {
      chart: { eligible: boolean; reason: string };
    };
    expect(incompatible.chart.eligible).toBe(false);
    expect(incompatible.chart.reason).toContain('different meanings or units');
  });

  it('exports all or filtered source rows as safe CSV and PDF, then blocks exports after deletion', async () => {
    const admin = actors[0]!;
    const campaignId = await createCampaign(admin, 'Export campaign');
    const upload = await preview(
      admin,
      campaignId,
      'Date,Formula,Count\n2026-06-01,=1+1,0\n2026-06-02,@SUM(A1),-3\n',
      'export.csv',
    );
    const imported = await confirm(admin, upload.result.id!);
    const datasetId = (imported.result as { id: string }).id;

    const allCsv = await request(`/datasets/${datasetId}/export.csv`, {
      headers: headers(admin, false),
    });
    expect(allCsv.status).toBe(200);
    const allText = await allCsv.text();
    expect(allText).toContain('"Date","Formula","Count"');
    expect(allText).toContain("'=1+1");
    expect(allText).toContain("'@SUM(A1)");
    expect(allText).toContain("'-3");
    expect(allText).toContain('"0"');

    const filtered = await request(
      `/datasets/${datasetId}/export.csv?dateColumnId=c1&from=2026-06-02&to=2026-06-02`,
      { headers: headers(admin, false) },
    );
    const filteredText = await filtered.text();
    expect(filtered.status).toBe(200);
    expect(filteredText).toContain('2026-06-02');
    expect(filteredText).not.toContain('2026-06-01');

    const pdf = await request(`/datasets/${datasetId}/export.pdf`, {
      headers: headers(admin, false),
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    expect((await pdf.arrayBuffer()).byteLength).toBeGreaterThan(100);

    const revisionPdf = await request(
      `/datasets/${datasetId}/export.pdf?expectedRevision=1`,
      { headers: headers(admin, false) },
    );
    expect(revisionPdf.status).toBe(200);
    const staleRevisionPdf = await request(
      `/datasets/${datasetId}/export.pdf?expectedRevision=2`,
      { headers: headers(admin, false) },
    );
    expect(staleRevisionPdf.status).toBe(409);

    const removed = await request(`/datasets/${datasetId}`, {
      method: 'DELETE',
      headers: headers(admin, false),
    });
    expect(removed.status).toBe(200);
    expect(
      (
        await request(`/datasets/${datasetId}/export.csv`, {
          headers: headers(admin, false),
        })
      ).status,
    ).toBe(404);
  });

  it('includes current datasets and staged imports in the campaign deletion preview', async () => {
    const admin = actors[0]!;
    const campaignId = await createCampaign(admin, 'Campaign with datasets');
    const content = 'Reach\n12\n';
    const created = await preview(admin, campaignId, content);
    const dataset = await confirm(admin, created.result.id!);
    expect(dataset.response.status).toBe(201);
    const datasetId = (dataset.result as { id: string }).id;
    const pending = await preview(admin, campaignId, 'Other value\n4\n');

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { archivedAt: new Date() },
    });
    const deletion = app.get(DeletionService);
    const previewResult = await deletion.preview(
      'campaigns',
      campaignId,
      admin.id,
    );
    expect(previewResult.counts.datasets).toBe(1);
    expect(previewResult.counts.datasetRevisions).toBe(1);
    expect(previewResult.counts.datasetRows).toBe(1);
    expect(previewResult.counts.pendingDatasetImports).toBe(1);
    expect(previewResult.counts.stagedDatasetRows).toBe(1);

    const removed = await deletion.remove(
      'campaigns',
      campaignId,
      admin.id,
      previewResult.confirmationReference!,
      previewResult.typedText,
    );
    expect(removed.deleted).toBe(true);
    expect(await prisma.dataset.count({ where: { campaignId } })).toBe(0);
    expect(
      await prisma.datasetRow.count({
        where: { revision: { datasetId } },
      }),
    ).toBe(0);
    const pendingBatch = await prisma.importBatch.findUniqueOrThrow({
      where: { id: pending.result.id! },
    });
    expect(pendingBatch.status).toBe('REJECTED');
    expect(pendingBatch.datasetAttemptInvalidatedAt).not.toBeNull();
    expect(
      await prisma.importRow.count({
        where: { importBatchId: pending.result.id! },
      }),
    ).toBe(0);
    expect(
      await prisma.campaign.findUnique({ where: { id: campaignId } }),
    ).toBeNull();
  });
});
