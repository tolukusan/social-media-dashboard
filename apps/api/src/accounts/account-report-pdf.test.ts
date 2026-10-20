import { describe, expect, it } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderAccountReportPdf } from './account-report-pdf.js';

describe('connected account PDF reports', () => {
  it('renders account scope, comparison metrics, top content, and caveats', async () => {
    const pdf = await renderAccountReportPdf({
      account: {
        displayName: 'Example Channel',
        provider: 'YOUTUBE',
        kind: 'SOCIAL',
        lastSyncedAt: '2026-10-14T12:00:00.000Z',
      },
      period: { from: '2026-10-01', to: '2026-10-14' },
      previousPeriod: { from: '2026-09-17', to: '2026-09-30' },
      metrics: [
        {
          code: 'VIEWS',
          label: 'Views',
          unit: 'COUNT',
          value: 42,
          previous: 30,
          difference: 12,
          percentageChange: 40,
        },
      ],
      series: [{ date: '2026-10-14', values: { VIEWS: 42 } }],
      topPosts: [
        {
          externalPostId: 'video_123',
          title: 'Useful video',
          postType: 'VIDEO',
          permalink: 'https://www.youtube.com/watch?v=video_123',
          publishedAt: '2026-10-01T09:00:00.000Z',
          metricCode: 'VIEWS',
          metricValue: 42,
        },
      ],
      caveats: ['Recent provider data can be delayed.'],
      generatedAt: '2026-10-14T12:05:00.000Z',
    });

    expect(pdf.subarray(0, 8).toString('ascii')).toBe('%PDF-1.3');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('prints annual coverage, snapshot dates, and bounded post-history caveats', async () => {
    const pdf = await renderAccountReportPdf({
      account: {
        displayName: 'Example Instagram',
        provider: 'INSTAGRAM',
        kind: 'SOCIAL',
        lastSyncedAt: '2026-10-20T12:00:00.000Z',
      },
      period: { from: '2025-10-21', to: '2026-10-20' },
      previousPeriod: { from: '2024-10-21', to: '2025-10-20' },
      metrics: [
        {
          code: 'MEDIA_VIEWS',
          label: 'Views',
          unit: 'COUNT',
          value: 700,
          previous: null,
          difference: null,
          percentageChange: null,
          coverage: {
            status: 'PARTIAL',
            requestedDays: 365,
            observedDays: 80,
          },
        },
        {
          code: 'AUDIENCE_SIZE',
          label: 'Followers',
          unit: 'COUNT',
          value: 420,
          previous: null,
          difference: null,
          percentageChange: null,
          coverage: {
            status: 'COMPLETE',
            requestedDays: null,
            observedDays: null,
            snapshotDate: '2026-10-20',
          },
        },
      ],
      series: [
        { date: '2025-10-21', values: { MEDIA_VIEWS: null } },
        { date: '2026-10-20', values: { MEDIA_VIEWS: 700 } },
      ],
      topPosts: [],
      coverage: {
        requestedDays: 365,
        latestSuccessfulHistoryFetchAt: '2026-10-20T11:00:00.000Z',
        postSnapshotRetentionDays: 90,
      },
      caveats: [
        'Daily reach is not a deduplicated count of unique accounts across the reporting period.',
      ],
      generatedAt: '2026-10-20T12:00:00.000Z',
    });
    const task = getDocument({ data: new Uint8Array(pdf) });
    const document = await task.promise;
    try {
      const text: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        text.push(
          ...content.items.flatMap((item) => ('str' in item ? [item.str] : [])),
        );
        page.cleanup();
      }
      const reportText = text.join(' ');
      expect(reportText).toContain('Partial total');
      expect(reportText).toContain('80 of 365 days available');
      expect(reportText).toContain('Snapshot observed 2026-10-20');
      expect(reportText).toContain('not a full-period ranking');
      expect(reportText).toContain(
        'not a deduplicated count of unique accounts',
      );
    } finally {
      await task.destroy();
    }
  });
});
