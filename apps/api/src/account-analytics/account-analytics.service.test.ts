import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AccountAnalyticsService } from './account-analytics.service.js';

describe('OAuth analytics ingestion', () => {
  const retrievedAt = new Date('2026-10-18T12:00:00.000Z');

  it('stores account and content values in the approved store with provider retention per metric', async () => {
    const definitions = [
      {
        id: 'followers-definition',
        provider: 'LINKEDIN_ORGANIC',
        code: 'AUDIENCE_SIZE',
        scope: 'ACCOUNT',
        retentionDays: 364,
        nonNegative: true,
        unit: 'COUNT',
      },
      {
        id: 'impressions-definition',
        provider: 'LINKEDIN_ORGANIC',
        code: 'ORGANIC_POST_IMPRESSIONS',
        scope: 'CONTENT',
        retentionDays: 42,
        nonNegative: true,
        unit: 'COUNT',
      },
    ];
    const createdRecords: Array<{ data: Record<string, unknown> }> = [];
    const metricValues: Array<{ data: Array<Record<string, unknown>> }> = [];
    let recordIndex = 0;
    const prisma = {
      connectedAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'account-id',
          provider: 'LINKEDIN',
          active: true,
        }),
      },
      integrationMetricDefinition: {
        findMany: vi.fn().mockResolvedValue(definitions),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          connectedAccountAnalyticsRecord: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn(
              async ({ data }: { data: Record<string, unknown> }) => {
                createdRecords.push({ data });
                recordIndex += 1;
                return { id: `record-${recordIndex}` };
              },
            ),
          },
          connectedAccountMetricValue: {
            createMany: vi.fn(
              async ({ data }: { data: Array<Record<string, unknown>> }) => {
                metricValues.push({ data });
              },
            ),
          },
        }),
      ),
    };
    const service = new AccountAnalyticsService(prisma as never);

    const result = await service.ingestConnectedAccount(
      'account-id',
      'LINKEDIN',
      [
        {
          date: '2026-10-17',
          scope: 'ACCOUNT',
          sourceObjectId: 'ACCOUNT',
          sourceObservationKey: 'account:2026-10-17',
          values: { AUDIENCE_SIZE: 500 },
        },
        {
          date: '2026-10-17',
          scope: 'CONTENT',
          sourceObjectId: 'share-1',
          sourceObservationKey: 'content:share-1:2026-10-01:2026-10-17',
          objectTitle: 'LinkedIn update',
          objectType: 'ARTICLE',
          objectUrl: 'https://example.invalid/post',
          objectOccurredAt: new Date('2026-10-10T10:00:00.000Z'),
          periodFrom: '2026-10-01',
          periodTo: '2026-10-17',
          dataScope: 'LIFETIME',
          values: { ORGANIC_POST_IMPRESSIONS: 120 },
        },
      ],
      'LinkedIn-Version-202610',
      retrievedAt,
    );

    expect(result).toEqual({ created: 2, updated: 0, unchanged: 0 });
    expect(createdRecords.map(({ data }) => data)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          connectedAccountId: 'account-id',
          sourceObservationKey: 'account:2026-10-17',
          scope: 'ACCOUNT',
          sourceObjectId: 'ACCOUNT',
          dataScope: null,
        }),
        expect.objectContaining({
          connectedAccountId: 'account-id',
          sourceObservationKey: 'content:share-1:2026-10-01:2026-10-17',
          scope: 'CONTENT',
          sourceObjectId: 'share-1',
          objectTitle: 'LinkedIn update',
          periodFrom: new Date('2026-10-01T00:00:00.000Z'),
          periodTo: new Date('2026-10-17T00:00:00.000Z'),
          dataScope: 'LIFETIME',
        }),
      ]),
    );
    const allValues = metricValues.flatMap(({ data }) => data);
    expect(allValues.map((item) => item.sourceDataExpiresAt)).toEqual([
      new Date(retrievedAt.getTime() + 364 * 24 * 60 * 60 * 1000),
      new Date(retrievedAt.getTime() + 42 * 24 * 60 * 60 * 1000),
    ]);
    expect(allValues.map((item) => item.metricDefinitionId)).toEqual([
      'followers-definition',
      'impressions-definition',
    ]);
  });

  it('rejects writes to disconnected accounts', async () => {
    const prisma = {
      connectedAccount: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'account-id',
          provider: 'INSTAGRAM',
          active: false,
        }),
      },
    };
    const service = new AccountAnalyticsService(prisma as never);
    await expect(
      service.ingestConnectedAccount('account-id', 'INSTAGRAM', [
        {
          date: '2026-10-17',
          sourceObservationKey: 'account:2026-10-17',
          values: { AUDIENCE_SIZE: 10 },
        },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
