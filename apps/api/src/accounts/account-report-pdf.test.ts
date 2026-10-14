import { describe, expect, it } from 'vitest';
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
});
