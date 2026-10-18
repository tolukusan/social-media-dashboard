import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

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
  await expect(page.locator('h1')).toHaveText('Accounts');
}
async function createCampaign(page: Page) {
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const user = await (await page.request.get(`${api}/auth/me`)).json();
  const channels = await (await page.request.get(`${api}/channels`)).json();
  const channel = channels.find(
    (item: { code: string }) => item.code === 'SOCIAL',
  );
  const platform = channel.platforms.find(
    (item: { code: string }) => item.code === 'FACEBOOK',
  );
  const csrf = await (await page.request.get(`${api}/auth/csrf`)).json();
  const response = await page.request.post(`${api}/campaigns`, {
    headers: {
      Origin: process.env.E2E_BASE_URL!,
      'x-csrf-token': csrf.csrfToken,
    },
    data: {
      name: `Guided journey ${randomUUID()}`,
      startDate: '2020-01-01',
      responsibleUserId: user.id,
      channels: [{ channelId: channel.id, platformIds: [platform.id] }],
    },
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ id: string; name: string }>;
}

test('recognised file reaches scoped results in four primary clicks and exports the same PDF scope', async ({
  page,
}, testInfo) => {
  await signIn(page);
  const campaign = await createCampaign(page);
  await page.goto(`/imports?campaignId=${campaign.id}`);
  const value = 10 + (Date.now() % 100000);
  await page.getByLabel('Select import file').setInputFiles({
    name: 'recognised.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        { Date: '2024-05-01', 'Facebook views': value },
        { Date: '2024-05-02', 'Facebook views': 0 },
      ]),
    ),
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '2. Confirm details' }),
  ).toBeFocused();
  await expect(page.locator('.import-details-summary')).toContainText(
    campaign.name,
  );
  await expect(page.getByLabel('Dataset/import name')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('confirm-details.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByText('Daily records: 2', { exact: true }),
  ).toBeVisible();
  let confirmations = 0;
  page.on('request', (request) => {
    if (/\/imports\/[^/]+\/confirm$/.test(request.url())) confirmations += 1;
  });
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await page.getByRole('link', { name: 'View results', exact: true }).click();
  expect(confirmations).toBe(1);
  await expect(page.getByLabel('From')).toHaveValue('2024-05-01');
  await expect(page.getByLabel('To')).toHaveValue('2024-05-02');
  await expect(page.locator('span.filter.muted')).toHaveText('2 records');
  await page.screenshot({
    path: testInfo.outputPath('import-results.png'),
    fullPage: true,
  });
  await expect(page.locator('.kpi-grid')).toContainText(
    value.toLocaleString('en-US'),
  );
  let reportQuery = '';
  page.on('request', (request) => {
    if (request.url().includes('/reports/dashboard.pdf'))
      reportQuery = request.url();
  });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect(await (await download).failure()).toBeNull();
  const params = new URL(reportQuery).searchParams;
  expect(params.get('campaignId')).toBe(campaign.id);
  expect(params.get('from')).toBe('2024-05-01');
  expect(params.get('to')).toBe('2024-05-02');
});

const campaignId = '00000000-0000-4000-8000-000000000001';
const secondCampaignId = '00000000-0000-4000-8000-000000000002';
const platformId = '00000000-0000-4000-8000-000000000003';
const emailId = '00000000-0000-4000-8000-000000000004';
const batchId = '00000000-0000-4000-8000-000000000005';
async function mockContext(page: Page) {
  await page.route('**/api/v1/campaigns', (route) =>
    route.fulfill({
      json: [
        { id: campaignId, name: 'Alpha' },
        { id: secondCampaignId, name: 'Beta' },
      ],
    }),
  );
  await page.route('**/api/v1/platforms', (route) =>
    route.fulfill({
      json: [
        {
          id: platformId,
          code: 'FACEBOOK',
          name: 'Facebook',
          channel: { id: 'social', name: 'Social' },
        },
        {
          id: emailId,
          code: 'EMAIL_GENERIC',
          name: 'Generic Email',
          channel: { id: 'email', name: 'Email' },
        },
      ],
    }),
  );
  await page.route('**/api/v1/channels', (route) =>
    route.fulfill({
      json: [
        {
          id: 'social',
          code: 'SOCIAL',
          name: 'Social',
          platforms: [{ id: platformId, name: 'Facebook' }],
        },
        {
          id: 'email',
          code: 'EMAIL',
          name: 'Email',
          platforms: [{ id: emailId, name: 'Generic Email' }],
        },
      ],
    }),
  );
  await page.route('**/api/v1/imports', (route) => route.fulfill({ json: [] }));
}
const sheet = {
  sheet: 'Social',
  source: { type: 'FACEBOOK_META', platform: 'FACEBOOK' },
  columns: ['Date', 'Facebook views'],
  rowCount: 2,
  sampleRows: [
    { sourceRowNumber: 2, data: { Date: '2024-01-01', 'Facebook views': 1 } },
  ],
  campaignValues: [],
  suggestedMapping: { Date: 'recordDate', 'Facebook views': 'SM_VIEWS' },
  dateRange: { from: '2024-01-01', to: '2024-01-02' },
};

test('worksheet switching refreshes context; partial imports require acknowledgement and give separate campaign result links', async ({
  page,
}) => {
  await signIn(page);
  await mockContext(page);
  const mail = {
    sheet: 'Mail',
    source: { type: 'EMAIL', platform: 'EMAIL' },
    columns: ['Sent time', 'Campaign name', 'Sent', 'Opened'],
    rowCount: 3,
    sampleRows: [
      {
        sourceRowNumber: 2,
        data: {
          'Sent time': '2024-02-01',
          'Campaign name': 'Alpha',
          Sent: 10,
          Opened: 3,
        },
      },
    ],
    campaignValues: ['Alpha', 'Beta'],
    suggestedMapping: {
      'Sent time': 'recordDate',
      'Campaign name': 'campaignName',
      Sent: 'EMAIL_SENT',
      Opened: 'EMAIL_OPENS',
    },
    dateRange: { from: '2024-02-01', to: '2024-02-02' },
  };
  await page.route('**/api/v1/imports/preview', (route) =>
    route.fulfill({
      json: {
        ...sheet,
        id: batchId,
        filename: 'two-sheets.xlsx',
        format: 'XLSX',
        checksum: 'mock',
        displayName: 'two-sheets',
        duplicateCompleted: false,
        warnings: [],
        sheets: ['Social', 'Mail'],
        sheetPreviews: [sheet, mail],
      },
    }),
  );
  const summary = {
    dailyRecords: 2,
    unchangedRecords: 0,
    scopes: [
      {
        campaignId,
        platformId: emailId,
        from: '2024-02-01',
        to: '2024-02-01',
        metricCodes: ['EMAIL_SENT'],
        dailyRecords: 1,
        unchangedRecords: 0,
      },
      {
        campaignId: secondCampaignId,
        platformId: emailId,
        from: '2024-02-02',
        to: '2024-02-02',
        metricCodes: ['EMAIL_SENT'],
        dailyRecords: 1,
        unchangedRecords: 0,
      },
    ],
  };
  await page.route(`**/api/v1/imports/${batchId}/map`, async (route) => {
    const body = route.request().postDataJSON();
    expect(body.selectedSheet).toBe('Mail');
    expect(body.platformId).toBe(emailId);
    expect(body.campaignMappings).toEqual({
      Alpha: campaignId,
      Beta: secondCampaignId,
    });
    expect(body.mapping).not.toHaveProperty('Facebook views');
    await route.fulfill({
      json: {
        id: batchId,
        status: 'READY',
        totalRows: 3,
        acceptedRows: 2,
        rejectedRows: 1,
        warningCount: 0,
        summary,
        rows: [
          {
            sourceRowNumber: 4,
            status: 'CONFLICT',
            errors: [
              { message: 'A merged metric has a different existing value.' },
            ],
            warnings: [],
          },
        ],
      },
    });
  });
  await page.route(`**/api/v1/imports/${batchId}/confirm`, (route) =>
    route.fulfill({ json: { status: 'COMPLETED', summary } }),
  );
  await page.goto(`/imports?campaignId=${campaignId}`);
  await page.getByLabel('Select import file').setInputFiles({
    name: 'two-sheets.xlsx',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock'),
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByLabel('Worksheet').selectOption('Mail');
  await expect(page.locator('.import-details-summary')).toContainText(
    'Generic Email',
  );
  await expect(page.locator('.import-details-summary')).toContainText(
    '2024-02-01',
  );
  await expect(page.locator('.import-details-summary')).toContainText(
    'Alpha, Beta',
  );
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Import data', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('checkbox', {
      name: 'Import 2 accepted rows and exclude 1 rejected/conflicting rows.',
    })
    .check();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'View results: Alpha' }),
  ).toHaveAttribute('href', new RegExp(`campaignId=${campaignId}`));
  await expect(
    page.getByRole('link', { name: 'View results: Beta' }),
  ).toHaveAttribute('href', new RegExp(`campaignId=${secondCampaignId}`));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('ambiguous platform needs a choice, validation failure can retry, and leaving warns about the draft', async ({
  page,
}) => {
  await signIn(page);
  await mockContext(page);
  const generic = {
    ...sheet,
    source: { type: 'GENERIC', platform: null },
    columns: ['Date', 'Views'],
    suggestedMapping: { Date: 'recordDate', Views: 'SM_VIEWS' },
    sampleRows: [],
  };
  await page.route('**/api/v1/imports/preview', (route) =>
    route.fulfill({
      json: {
        ...generic,
        id: batchId,
        filename: 'ambiguous.json',
        displayName: 'ambiguous',
        duplicateCompleted: false,
        warnings: [],
        sheets: ['Social'],
        sheetPreviews: [generic],
      },
    }),
  );
  let attempts = 0;
  await page.route(`**/api/v1/imports/${batchId}/map`, async (route) => {
    attempts += 1;
    if (attempts === 1)
      await route.fulfill({
        status: 503,
        json: { message: 'Temporary validation failure. Try again.' },
      });
    else
      await route.fulfill({
        json: {
          id: batchId,
          status: 'REJECTED',
          totalRows: 2,
          acceptedRows: 0,
          rejectedRows: 2,
          warningCount: 0,
          summary: { dailyRecords: 0, unchangedRecords: 0, scopes: [] },
          rows: [
            {
              sourceRowNumber: 2,
              status: 'REJECTED',
              errors: [{ message: 'A valid date is required.' }],
              warnings: [],
            },
          ],
        },
      });
  });
  await page.goto(`/imports?campaignId=${campaignId}`);
  await page.getByLabel('Select import file').setInputFiles({
    name: 'ambiguous.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[]'),
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Platform', { exact: true }).selectOption(platformId);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Temporary validation failure' }),
  ).toContainText('Temporary validation failure');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Import data', exact: true }),
  ).toBeDisabled();
  page.once('dialog', (dialog) => {
    expect(dialog.message()).toContain('unfinished import');
    return dialog.dismiss();
  });
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(
    page.getByRole('heading', { name: '3. Review and import' }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('Management sees results without import onboarding and backend still denies import writes', async ({
  page,
}) => {
  await signIn(page, 'management');
  await expect(
    page.getByRole('link', { name: 'Imports', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: 'Add your first data', exact: true }),
  ).toHaveCount(0);
  await page.goto('/imports');
  await expect(
    page.getByRole('heading', {
      name: 'Results are available in your workspace',
    }),
  ).toBeVisible();
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const csrf = await (await page.request.get(`${api}/auth/csrf`)).json();
  const response = await page.request.post(`${api}/imports/preview`, {
    headers: {
      Origin: process.env.E2E_BASE_URL!,
      'x-csrf-token': csrf.csrfToken,
    },
    multipart: {
      file: {
        name: 'denied.json',
        mimeType: 'application/json',
        buffer: Buffer.from('[{"Date":"2024-01-01","Views":1}]'),
      },
    },
  });
  expect(response.status()).toBe(403);
});
