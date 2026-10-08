import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { NestFactory } from '@nestjs/core';
import { PrismaPg } from '@prisma/adapter-pg';
import ExcelJS from 'exceljs';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppModule } from '../app.module.js';
import { ImportsService } from './imports.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { ReportsService } from '../reports/reports.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.TEST_DATABASE_URL! }),
});
const batches: string[] = [];
const campaigns: string[] = [];
let app: Awaited<ReturnType<typeof NestFactory.create>>;
let service: ImportsService;
let actorId: string;
let facebook: { id: string; channelId: string };
let email: { id: string; channelId: string };
async function campaign(platform = facebook) {
  const value = await prisma.campaign.create({
    data: {
      name: `Guided import ${randomUUID()}`,
      startDate: new Date('2020-01-01'),
      status: 'ACTIVE',
      responsibleUserId: actorId,
      createdByUserId: actorId,
      updatedByUserId: actorId,
      campaignChannels: {
        create: {
          channelId: platform.channelId,
          campaignPlatforms: { create: { platformId: platform.id } },
        },
      },
    },
  });
  campaigns.push(value.id);
  return value.id;
}
async function preview(rows: Array<Record<string, unknown>>) {
  const buffer = Buffer.from(JSON.stringify(rows));
  const value = await service.preview(
    { originalname: `${randomUUID()}.json`, size: buffer.length, buffer },
    actorId,
  );
  batches.push(value.id);
  return value;
}
async function mapped(
  rows: Array<Record<string, unknown>>,
  campaignId: string,
  action: 'CREATE' | 'APPEND' | 'MERGE' = 'CREATE',
) {
  const staged = await preview(rows);
  const value = await service.map(staged.id, {
    mapping: staged.suggestedMapping!,
    platformId: facebook.id,
    campaignId,
    selectedSheet: staged.sheets[0],
    datasetAction: action,
  });
  return { staged, value };
}

describe('guided import preview, review, and committed result contracts', () => {
  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    service = app.get(ImportsService);
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: 'ADMIN' },
    });
    actorId = (
      await prisma.user.create({
        data: {
          name: 'Guidance fixture',
          email: `${randomUUID()}@example.test`,
          roleId: role.id,
          passwordHash: 'isolated-unused-fixture-hash',
        },
      })
    ).id;
    facebook = await prisma.platform.findFirstOrThrow({
      where: { code: 'FACEBOOK' },
    });
    email = await prisma.platform.findFirstOrThrow({
      where: { code: 'EMAIL_GENERIC' },
    });
  });
  afterAll(async () => {
    await app?.close();
    const records = await prisma.performanceRecord.findMany({
      where: {
        campaignPlatform: {
          campaignChannel: { campaignId: { in: campaigns } },
        },
      },
      select: { id: true },
    });
    await prisma.performanceMetricValue.deleteMany({
      where: {
        performanceRecordId: { in: records.map((record) => record.id) },
      },
    });
    await prisma.performanceRecord.deleteMany({
      where: { id: { in: records.map((record) => record.id) } },
    });
    await prisma.importRow.deleteMany({
      where: { importBatchId: { in: batches } },
    });
    await prisma.importBatch.deleteMany({ where: { id: { in: batches } } });
    await prisma.campaignPlatform.deleteMany({
      where: { campaignChannel: { campaignId: { in: campaigns } } },
    });
    await prisma.campaignChannel.deleteMany({
      where: { campaignId: { in: campaigns } },
    });
    await prisma.campaign.deleteMany({ where: { id: { in: campaigns } } });
    await prisma.auditLog.deleteMany({ where: { actorUserId: actorId } });
    await prisma.user.delete({ where: { id: actorId } });
    await prisma.$disconnect();
  });
  it('summarizes accepted canonical dates, preserves zero/missing values, and matches dashboard/report scope', async () => {
    const id = await campaign();
    const { staged, value } = await mapped(
      [
        { Date: '2024-07-01', 'Facebook views': 0, Follows: '' },
        { Date: '2024-07-01', 'Facebook views': 5 },
        { Date: '2024-07-03', 'Facebook views': 2 },
        { Date: 'not-a-date', 'Facebook views': 9 },
      ],
      id,
    );
    expect(value.acceptedRows).toBe(3);
    expect(value.rejectedRows).toBe(1);
    expect(value.summary.dailyRecords).toBe(2);
    const completed = await service.confirm(staged.id);
    expect(completed.summary).toEqual(value.summary);
    const scope = completed.summary.scopes[0];
    expect(scope.from).toBe('2024-07-01');
    expect(scope.to).toBe('2024-07-03');
    const filters = {
      campaignId: id,
      platformId: facebook.id,
      from: scope.from,
      to: scope.to,
    };
    const dashboard = await app.get(AnalyticsService).dashboard(filters);
    const report = await app.get(ReportsService).assemble(filters);
    expect(dashboard.recordCount).toBe(2);
    expect(dashboard.rawTotals.SM_VIEWS).toBe(7);
    expect(dashboard.rawTotals.SM_FOLLOWERS_GAINED).toBeNull();
    expect(report.summary.recordCount).toBe(dashboard.recordCount);
    expect(
      report.summary.kpis.find((metric) => metric.code === 'SM_VIEWS')?.value,
    ).toBe(7);
    expect(report.period).toEqual({ from: scope.from, to: scope.to });
    expect(report.trend?.metric).toBe(
      dashboard.metricMetadata.find((metric) => metric.code === 'SM_VIEWS')
        ?.label,
    );
    await expect(service.confirm(staged.id)).rejects.toThrow();
  });
  it('reports missing-metric merge and equal-value no-op while conflicting values stay excluded', async () => {
    const id = await campaign();
    const first = await mapped(
      [{ Date: '2024-08-01', 'Facebook views': 0 }],
      id,
    );
    await service.confirm(first.staged.id);
    const merge = await mapped(
      [{ Date: '2024-08-01', 'Facebook views': 0, Follows: 2 }],
      id,
      'MERGE',
    );
    expect(merge.value.summary.scopes[0].metricCodes).toEqual([
      'SM_FOLLOWERS_GAINED',
    ]);
    await service.confirm(merge.staged.id);
    const noop = await mapped(
      [{ Date: '2024-08-01', 'Facebook views': 0, Follows: 2 }],
      id,
      'MERGE',
    );
    expect(noop.value.summary.unchangedRecords).toBe(1);
    const conflict = await mapped(
      [{ Date: '2024-08-01', 'Facebook views': 1 }],
      id,
      'MERGE',
    );
    expect(conflict.value.status).toBe('REJECTED');
    expect(conflict.value.summary.scopes).toEqual([]);
    await expect(service.confirm(conflict.staged.id)).rejects.toThrow();
  });
  it('keeps append collisions and archived dates protected', async () => {
    const id = await campaign();
    const first = await mapped(
      [{ Date: '2024-09-01', 'Facebook views': 3 }],
      id,
    );
    await service.confirm(first.staged.id);
    const append = await mapped(
      [
        { Date: '2024-09-01', 'Facebook views': 4 },
        { Date: '2024-09-02', 'Facebook views': 5 },
      ],
      id,
      'APPEND',
    );
    expect(append.value.rejectedRows).toBe(1);
    expect(append.value.summary.scopes[0].from).toBe('2024-09-02');
    await prisma.performanceRecord.updateMany({
      where: { importBatchId: first.staged.id },
      data: { status: 'ARCHIVED' },
    });
    const archived = await mapped(
      [{ Date: '2024-09-01', Follows: 2 }],
      id,
      'MERGE',
    );
    expect(archived.value.status).toBe('REJECTED');
    expect(archived.value.summary.dailyRecords).toBe(0);
  });
  it('updates columns, dates, campaigns, and suggestions independently for each usable worksheet', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('Empty');
    const social = workbook.addWorksheet('Social');
    social.addRow(['Date', 'Facebook views']);
    social.addRow(['2024-01-01', 10]);
    const mail = workbook.addWorksheet('Mail');
    mail.addRow(['Sent time', 'Campaign name', 'Sent', 'Opened']);
    mail.addRow(['2024-02-03', 'Alpha', 20, 5]);
    mail.addRow(['2024-02-04', 'Beta', 30, 6]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const staged = await service.preview(
      { originalname: `${randomUUID()}.xlsx`, size: buffer.length, buffer },
      actorId,
    );
    batches.push(staged.id);
    expect(staged.sheets).toEqual(['Social', 'Mail']);
    expect(staged.columns).toEqual(['Date', 'Facebook views']);
    const next = staged.sheetPreviews[1];
    expect(next.source.type).toBe('EMAIL');
    expect(next.campaignValues).toEqual(['Alpha', 'Beta']);
    expect(next.dateRange).toEqual({ from: '2024-02-03', to: '2024-02-04' });
    const alpha = await campaign(email);
    const beta = await campaign(email);
    const review = await service.map(staged.id, {
      mapping: next.suggestedMapping,
      selectedSheet: 'Mail',
      campaignMappings: { Alpha: alpha, Beta: beta },
      platformId: email.id,
    });
    expect(review.summary.scopes.map((scope) => scope.campaignId)).toEqual([
      alpha,
      beta,
    ]);
    expect(review.summary.scopes.map((scope) => scope.from)).toEqual([
      '2024-02-03',
      '2024-02-04',
    ]);
    expect(review.totalRows).toBe(2);
  });
  it('reuses previous mappings with current header identity and keeps original raw fields intact', async () => {
    const id = await campaign();
    const first = await mapped(
      [{ Date: '2024-10-01', 'Facebook views': 9 }],
      id,
    );
    await service.confirm(first.staged.id);
    const staged = await preview([
      { date: '2024-10-02', 'facebook views': 11 },
    ]);
    expect(staged.matchingTemplate?.mapping).toEqual({
      date: 'recordDate',
      'facebook views': 'SM_VIEWS',
    });
    const raw = await prisma.importRow.findFirstOrThrow({
      where: { importBatchId: staged.id },
    });
    expect(raw.rawData).toEqual({ date: '2024-10-02', 'facebook views': 11 });
  });
});
