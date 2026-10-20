import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function signIn(page: Page, role = 'administrator') {
  const credentials = JSON.parse(
    await readFile('apps/api/.e2e-credentials', 'utf8'),
  ) as Record<string, { email: string; password: string }>;
  await page.goto('/');
  await page.getByLabel('Email address').fill(credentials[role].email);
  await page
    .getByLabel('Password', { exact: true })
    .fill(credentials[role].password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await page
    .getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('button', { name: 'Accounts', exact: true })
    .click();
  await expect(page.locator('h1')).toHaveText('Accounts');
}

async function verifyResponsiveWidths(page: Page) {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('Administrator opens Accounts and sees safe provider setup guidance', async ({
  page,
}) => {
  await signIn(page);

  await expect(
    page.getByRole('heading', { name: 'Your connected accounts' }),
  ).toBeVisible();
  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  const sectionNavigation = page.getByRole('navigation', {
    name: 'Section navigation',
  });
  await expect(
    navigation.getByRole('button', { name: 'Accounts', exact: true }),
  ).toHaveAttribute('aria-current', 'page');

  for (const provider of [
    'Instagram',
    'Facebook Pages',
    'LinkedIn Pages',
    'YouTube',
    'Zoho Campaigns',
  ]) {
    const card = page.locator('.provider-card').filter({
      has: page.getByRole('heading', { name: provider, exact: true }),
    });
    await expect(card).toContainText('API setup needed');
    await expect(
      card.getByRole('button', { name: 'Connect', exact: true }),
    ).toBeDisabled();
    await card
      .getByText('What the workspace administrator needs to configure')
      .click();
    await expect(card.getByText(/Required server settings:/)).toBeVisible();
  }

  await expect(
    page.getByText('No social accounts connected', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('No Zoho reporting connection yet.', { exact: true }),
  ).toBeVisible();
  await sectionNavigation
    .getByRole('button', { name: 'Email reports', exact: true })
    .click();
  await expect(
    page.getByText('No Zoho Campaigns account connected', { exact: true }),
  ).toBeVisible();
  await sectionNavigation
    .getByRole('button', { name: 'Compare', exact: true })
    .click();
  await expect(page.getByLabel('From', { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await expect(page.getByLabel('To', { exact: true })).toHaveValue(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  const from = await page.getByLabel('From', { exact: true }).inputValue();
  const to = await page.getByLabel('To', { exact: true }).inputValue();
  expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)).toBe(
    29 * 24 * 60 * 60 * 1000,
  );
});

test('OAuth account callback outcomes are shown without credential values', async ({
  page,
}) => {
  await signIn(page);

  const outcomes = [
    ['connected', 'YouTube connected. The first account sync has started.'],
    ['no-accounts', 'No eligible YouTube accounts were found for this login.'],
    ['cancelled', 'Account connection was cancelled.'],
    [
      'error',
      'The provider could not complete account connection. Review its setup and try again.',
    ],
  ] as const;

  for (const [outcome, message] of outcomes) {
    await page.goto(`/?accountConnection=${outcome}&provider=YOUTUBE`);
    await expect(page.locator('.notice.account-success')).toHaveText(message);
    await expect
      .poll(() => new URL(page.url()).searchParams.has('accountConnection'))
      .toBe(false);
  }
});

test('Management can review Accounts but cannot start provider connections', async ({
  page,
}) => {
  await signIn(page, 'management');
  await expect(
    page.getByText(
      /Ask an Administrator or Marketing Officer to connect accounts/,
    ),
  ).toBeVisible();
  await expect(page.locator('.provider-card')).toHaveCount(5);
  for (const button of await page
    .locator('.provider-card')
    .getByRole('button', { name: 'Connect', exact: true })
    .all())
    await expect(button).toBeDisabled();
});

test('compares accounts and keeps provider-specific measures and content separate', async ({
  page,
}) => {
  const apiUrl = process.env.E2E_API_URL!;
  const baseUrl = process.env.E2E_BASE_URL!;
  const accounts = [
    {
      id: 'instagram-account',
      provider: 'INSTAGRAM',
      kind: 'SOCIAL',
      externalAccountId: 'ig-1',
      displayName: 'Example Instagram',
      handle: 'example',
      profileUrl: null,
      active: true,
      connectedAt: '2026-08-01T00:00:00.000Z',
      lastSyncedAt: null,
      lastSyncErrorCode: null,
      retention: { reportingDays: 365, postSnapshotDays: 90 },
    },
    {
      id: 'youtube-account',
      provider: 'YOUTUBE',
      kind: 'SOCIAL',
      externalAccountId: 'yt-1',
      displayName: 'Example YouTube',
      handle: null,
      profileUrl: null,
      active: true,
      connectedAt: '2026-08-01T00:00:00.000Z',
      lastSyncedAt: new Date(Date.now() - 27 * 60 * 60_000).toISOString(),
      lastSyncErrorCode: null,
      retention: { reportingDays: null, postSnapshotDays: null },
    },
    {
      id: 'zoho-account',
      provider: 'ZOHO_CAMPAIGNS',
      kind: 'EMAIL',
      externalAccountId: 'zoho-us',
      displayName: 'Example Zoho',
      handle: null,
      profileUrl: null,
      active: true,
      connectedAt: '2026-08-01T00:00:00.000Z',
      lastSyncedAt: new Date().toISOString(),
      lastSyncErrorCode: null,
      retention: { reportingDays: null, postSnapshotDays: null },
    },
  ];
  const accountBase = {
    period: { from: '2026-09-18', to: '2026-10-17' },
    previousPeriod: { from: '2026-08-19', to: '2026-09-17' },
    series: [],
    caveats: [],
    dataAvailableThrough: null,
    coverage: {
      requestedDays: 30,
      latestSuccessfulHistoryFetchAt: null,
      postSnapshotRetentionDays: 90,
    },
    generatedAt: new Date().toISOString(),
  };
  const reports: Record<string, unknown> = {
    'instagram-account': {
      ...accountBase,
      account: accounts[0],
      metrics: [
        {
          code: 'AUDIENCE_SIZE',
          label: 'Followers',
          unit: 'COUNT',
          mode: 'SNAPSHOT',
          value: 1250,
          previous: 1200,
          difference: 50,
          percentageChange: 4.17,
          coverage: {
            status: 'COMPLETE',
            requestedDays: null,
            observedDays: null,
            firstObservedDate: '2026-10-17',
            lastObservedDate: '2026-10-17',
            snapshotDate: '2026-10-17',
          },
        },
        {
          code: 'MEDIA_VIEWS',
          label: 'Views',
          unit: 'COUNT',
          mode: 'SUM',
          value: 900,
          previous: null,
          difference: null,
          percentageChange: null,
          coverage: {
            status: 'PARTIAL',
            requestedDays: 30,
            observedDays: 18,
            firstObservedDate: '2026-10-01',
            lastObservedDate: '2026-10-17',
          },
        },
      ],
      topPosts: [
        {
          externalPostId: 'ig-post-1',
          title: 'Instagram launch reel',
          postType: 'REEL',
          permalink: null,
          publishedAt: '2026-10-01T00:00:00.000Z',
          dataScope: 'LIFETIME',
          metricCode: 'VIEWS',
          metricValue: 750,
        },
      ],
    },
    'youtube-account': {
      ...accountBase,
      account: accounts[1],
      metrics: [
        {
          code: 'AUDIENCE_SIZE',
          label: 'Subscribers',
          unit: 'COUNT',
          mode: 'SNAPSHOT',
          value: 620,
          previous: 610,
          difference: 10,
          percentageChange: 1.64,
          coverage: {
            status: 'COMPLETE',
            requestedDays: null,
            observedDays: null,
            firstObservedDate: '2026-10-17',
            lastObservedDate: '2026-10-17',
            snapshotDate: '2026-10-17',
          },
        },
        {
          code: 'VIEWS',
          label: 'Video views',
          unit: 'COUNT',
          mode: 'SUM',
          value: 4200,
          previous: null,
          difference: null,
          percentageChange: null,
          coverage: {
            status: 'COMPLETE',
            requestedDays: 30,
            observedDays: 30,
            firstObservedDate: '2026-09-18',
            lastObservedDate: '2026-10-17',
          },
        },
      ],
      topPosts: [
        {
          externalPostId: 'yt-video-1',
          title: 'YouTube launch video',
          postType: 'VIDEO',
          permalink: null,
          publishedAt: '2026-10-02T00:00:00.000Z',
          dataScope: 'DATE_RANGE',
          metricCode: 'VIEWS',
          metricValue: 3200,
        },
      ],
    },
  };

  await page.route(`${apiUrl}/accounts`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      json: accounts,
      headers: {
        'access-control-allow-origin': baseUrl,
        'access-control-allow-credentials': 'true',
      },
    });
  });
  await page.route(/\/api\/v1\/accounts\/[^/]+\/analytics\?/, async (route) => {
    const accountId = new URL(route.request().url()).pathname
      .split('/')
      .at(-2)!;
    const report = structuredClone(reports[accountId]) as Record<string, any>;
    const params = new URL(route.request().url()).searchParams;
    const start = new Date(`${params.get('from')}T00:00:00Z`);
    const end = new Date(`${params.get('to')}T00:00:00Z`);
    const requestedDays =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (report.coverage) report.coverage.requestedDays = requestedDays;
    for (const metric of report.metrics ?? []) {
      if (metric.mode !== 'SUM' || !metric.coverage) continue;
      const observedDays = Math.min(requestedDays, 18);
      metric.coverage = {
        ...metric.coverage,
        status: observedDays === requestedDays ? 'COMPLETE' : 'PARTIAL',
        requestedDays,
        observedDays,
      };
    }
    await route.fulfill({
      json: report,
      headers: {
        'access-control-allow-origin': baseUrl,
        'access-control-allow-credentials': 'true',
      },
    });
  });
  await page.route(
    /\/api\/v1\/accounts\/zoho-account\/email-report\?/,
    async (route) => {
      await route.fulfill({
        json: {
          account: accounts[2],
          period: accountBase.period,
          generatedAt: new Date().toISOString(),
          campaignCount: 2,
          totals: {
            SENT: 440,
            DELIVERED: 400,
            OPENS: 120,
            UNIQUE_CLICKS: 30,
            OPEN_RATE: 17.5,
            UNIQUE_CLICK_RATE: 7.25,
          },
          campaigns: [
            {
              externalCampaignId: 'campaign-two',
              name: 'September recap',
              sentAt: '2026-09-25T09:30:00.000Z',
              observedAt: new Date().toISOString(),
              metricValues: {
                SENT: 320,
                DELIVERED: 300,
                OPENS: 84,
                UNIQUE_CLICKS: 18,
                OPEN_RATE: 28,
                UNIQUE_CLICK_RATE: 6,
              },
            },
            {
              externalCampaignId: 'campaign-one',
              name: 'October update',
              sentAt: '2026-10-14T09:30:00.000Z',
              observedAt: new Date().toISOString(),
              metricValues: {
                SENT: 120,
                DELIVERED: 110,
                OPENS: 39,
                UNIQUE_CLICKS: 11,
                OPEN_RATE: 35.45,
                UNIQUE_CLICK_RATE: 10,
              },
            },
          ],
          caveats: [
            'Zoho-reported unique open and click percentages are weighted by delivered emails. Missing provider metrics remain unavailable rather than being shown as zero.',
          ],
        },
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
  let syncRange: { from: string; to: string } | undefined;
  let syncJob: Record<string, unknown> | null = null;
  let syncJobDetailPolls = 0;
  await page.route(
    /\/api\/v1\/accounts\/instagram-account\/sync-jobs\/active$/,
    async (route) => {
      const activeJob =
        syncJob && ['QUEUED', 'RUNNING'].includes(String(syncJob.status))
          ? syncJob
          : null;
      await route.fulfill({
        json: activeJob,
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
  await page.route(
    /\/api\/v1\/accounts\/instagram-account\/sync-jobs\/fixture-sync-job$/,
    async (route) => {
      syncJobDetailPolls += 1;
      if (syncJob && syncJobDetailPolls >= 2) {
        syncJob = {
          ...syncJob,
          status: 'SUCCEEDED',
          completedChunks: 3,
          successfulChunks: 3,
          completedAt: new Date().toISOString(),
        };
      } else if (syncJob) {
        syncJob = { ...syncJob, status: 'RUNNING' };
      }
      await route.fulfill({
        json: syncJob,
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
  await page.route(
    /\/api\/v1\/accounts\/instagram-account\/sync-jobs$/,
    async (route) => {
      syncRange = route.request().postDataJSON() as {
        from: string;
        to: string;
      };
      syncJobDetailPolls = 0;
      syncJob = {
        id: 'fixture-sync-job',
        status: 'QUEUED',
        requestedPeriod: syncRange,
        fetchablePeriod: { from: syncRange.from, to: syncRange.to },
        completedChunks: 0,
        totalChunks: 3,
        successfulChunks: 0,
        failedChunks: 0,
        errors: [],
        finalErrorCode: null,
        updatedAt: new Date().toISOString(),
        completedAt: null,
        queued: true,
      };
      await route.fulfill({
        status: 202,
        json: syncJob,
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
  let emailSyncRange: { from: string; to: string } | undefined;
  await page.route(
    /\/api\/v1\/accounts\/zoho-account\/sync$/,
    async (route) => {
      emailSyncRange = route.request().postDataJSON() as {
        from: string;
        to: string;
      };
      await route.fulfill({
        json: { observations: 2, posts: 0, emailCampaigns: 2 },
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
  await page.route(
    /\/api\/v1\/accounts\/instagram-account\/report\.pdf\?/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-1.4\nE2E fixture report\n%%EOF',
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );
  await page.route(
    /\/api\/v1\/accounts\/zoho-account\/email-report\.pdf\?/,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-1.4\nE2E fixture email report\n%%EOF',
        headers: {
          'access-control-allow-origin': baseUrl,
          'access-control-allow-credentials': 'true',
        },
      });
    },
  );

  await signIn(page);
  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  const sectionNavigation = page.getByRole('navigation', {
    name: 'Section navigation',
  });
  await expect(page.locator('.connected-account-select')).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: 'test-results/dashboard-redesign-accounts-home.png',
    fullPage: true,
  });
  await verifyResponsiveWidths(page);
  await page.locator('.connected-account-select').first().click();
  const insights = page.locator('.account-dashboard');
  await expect(insights).toBeVisible();
  await expect(insights.locator('.metric-tile-value').first()).toHaveText(
    '1,250',
  );
  await expect(insights).toContainText('Instagram launch reel');
  await expect(insights).toContainText('lifetime');
  await page.screenshot({
    path: 'test-results/dashboard-redesign-insights.png',
    fullPage: true,
  });
  await verifyResponsiveWidths(page);
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  const insightsFrom = await page
    .getByLabel('From', { exact: true })
    .inputValue();
  const insightsTo = await page.getByLabel('To', { exact: true }).inputValue();
  await insights
    .getByRole('button', { name: 'Sync available history' })
    .click();
  await expect(page.locator('.notice.account-success')).toContainText(
    'Available history is queued.',
  );
  await expect(insights.locator('.sync-job-status')).toContainText(
    'Fetching available history',
  );
  await expect(
    insights.getByRole('button', { name: 'Sync available history' }),
  ).toBeDisabled();
  expect(syncRange).toEqual({ from: insightsFrom, to: insightsTo });
  await expect(insights.locator('.sync-job-status')).toContainText(
    'History sync completed',
    { timeout: 10_000 },
  );
  await expect(
    insights.getByRole('button', { name: 'Sync available history' }),
  ).toBeEnabled();
  const pdfPromise = page.waitForEvent('download');
  await insights.getByRole('button', { name: 'Download PDF' }).click();
  const pdfDownload = await pdfPromise;
  expect(pdfDownload.suggestedFilename()).toBe(
    `instagram-report-${insightsTo}.pdf`,
  );
  const pdfPath = await pdfDownload.path();
  expect(pdfPath).toBeTruthy();
  expect(await readFile(pdfPath!, 'utf8')).toContain('%PDF-1.4');
  await page.getByRole('button', { name: 'Last 365 days' }).click();
  await expect(insights).toContainText(
    'Partial total — 18 of 365 days available',
  );
  await expect(insights).toContainText(
    'Instagram supplies recent account history. Older saved days remain available in Marketwise.',
  );
  await verifyResponsiveWidths(page);
  await page.screenshot({
    path: 'test-results/meta-year-report-desktop.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'test-results/meta-year-report-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await sectionNavigation
    .getByRole('button', { name: 'Compare', exact: true })
    .click();
  const comparison = page.locator('.account-comparison-panel');
  await expect(
    comparison.getByRole('heading', { name: 'Social performance' }),
  ).toBeVisible();
  const instagramCard = comparison
    .locator('.comparison-account-card')
    .filter({ hasText: 'Example Instagram' });
  const youtubeCard = comparison
    .locator('.comparison-account-card')
    .filter({ hasText: 'Example YouTube' });
  await expect(instagramCard).toContainText('1,250');
  await expect(instagramCard).toContainText('Followers');
  await expect(youtubeCard).toContainText('Subscribers');
  await expect(comparison).toContainText('Instagram launch reel');
  await expect(comparison).toContainText('Lifetime');
  await expect(comparison).toContainText('YouTube launch video');
  await expect(comparison).toContainText('Selected period');
  await page.screenshot({
    path: 'test-results/dashboard-redesign-comparison.png',
    fullPage: true,
  });
  await verifyResponsiveWidths(page);
  const from = await page.getByLabel('From', { exact: true }).inputValue();
  const to = await page.getByLabel('To', { exact: true }).inputValue();
  const downloadPromise = page.waitForEvent('download');
  await comparison
    .getByRole('button', { name: 'Download comparison CSV' })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    `account-comparison-${from}-${to}.csv`,
  );
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const csv = await readFile(downloadPath!, 'utf8');
  expect(csv).toContain('Instagram: Followers | YouTube: Subscribers');
  const contentRows = csv
    .split('\r\n')
    .filter((row) => row.startsWith('"Top content",'));
  const fields = (row: string | undefined) =>
    row?.split(',').map((cell) => cell.slice(1, -1).replaceAll('""', '"'));
  const instagramContent = contentRows.find((row) =>
    row.includes('Instagram launch reel'),
  );
  const youtubeContent = contentRows.find((row) =>
    row.includes('YouTube launch video'),
  );
  const instagramFields = fields(instagramContent);
  const youtubeFields = fields(youtubeContent);
  expect(instagramFields?.[4]).toBe('Lifetime');
  expect(instagramFields?.[5]).toBe('');
  expect(instagramFields?.[6]).toBe('');
  expect(youtubeFields?.[4]).toBe('Selected period');
  expect(youtubeFields?.[5]).toBe(from);
  expect(youtubeFields?.[6]).toBe(to);
  await sectionNavigation
    .getByRole('button', { name: 'Email reports', exact: true })
    .click();
  await page.getByLabel('Zoho account').selectOption('zoho-account');
  const emailReport = page.locator('.email-report-panel');
  await expect(emailReport).toContainText('17.5%');
  await expect(emailReport).toContainText('7.25%');
  await expect(emailReport).toContainText('35.45%');
  await expect(emailReport).toContainText('10%');
  await expect(emailReport).toContainText('September recap');
  await page.getByLabel('Filter campaigns').fill('October');
  await expect(emailReport).toContainText('Showing 1 of 2 campaigns');
  await expect(emailReport).not.toContainText('September recap');
  await expect(
    emailReport.getByRole('columnheader', {
      name: 'Zoho-reported open rate',
    }),
  ).toBeVisible();
  await expect(emailReport).toContainText(
    'Missing provider metrics remain unavailable',
  );
  await page.screenshot({
    path: 'test-results/dashboard-redesign-email-reports.png',
    fullPage: true,
  });
  await verifyResponsiveWidths(page);
  const emailFrom = await page.getByLabel('From', { exact: true }).inputValue();
  const emailTo = await page.getByLabel('To', { exact: true }).inputValue();
  await emailReport
    .getByRole('button', { name: 'Refresh report data' })
    .click();
  await expect(page.locator('.notice.account-success')).toContainText(
    'Updated this period: 2 daily metrics, 0 content items, and 2 email campaigns.',
  );
  expect(emailSyncRange).toEqual({ from: emailFrom, to: emailTo });
  const emailPdfPromise = page.waitForEvent('download');
  await emailReport
    .getByRole('button', { name: 'Download PDF report' })
    .click();
  const emailPdfDownload = await emailPdfPromise;
  expect(emailPdfDownload.suggestedFilename()).toBe(
    `zoho_campaigns-email-report-${emailTo}.pdf`,
  );
  const emailPdfPath = await emailPdfDownload.path();
  expect(emailPdfPath).toBeTruthy();
  expect(await readFile(emailPdfPath!, 'utf8')).toContain('%PDF-1.4');
  await navigation
    .getByRole('button', { name: 'Accounts', exact: true })
    .click();
  const instagramHomeCard = page
    .locator('.connected-account')
    .filter({ hasText: 'Example Instagram' });
  const youtubeHomeCard = page
    .locator('.connected-account')
    .filter({ hasText: 'Example YouTube' });
  await expect(instagramHomeCard).toContainText('No successful sync');
  await expect(instagramHomeCard).toContainText(
    'Automatic updates need a successful first sync.',
  );
  await expect(youtubeHomeCard).toContainText('Update is stale');
  await expect(youtubeHomeCard).toContainText('Last successful update');
});
