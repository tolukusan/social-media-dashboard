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
  await expect(page.locator('h1')).toHaveText('Overview');
}

async function createCampaign(page: Page) {
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const user = await (await page.request.get(`${api}/auth/me`)).json();
  const csrf = await (await page.request.get(`${api}/auth/csrf`)).json();
  const name = `Dataset campaign ${randomUUID()}`;
  const response = await page.request.post(`${api}/campaigns`, {
    headers: {
      Origin: process.env.E2E_BASE_URL!,
      'x-csrf-token': csrf.csrfToken,
    },
    data: {
      name,
      startDate: '2020-01-01',
      responsibleUserId: user.id,
      channels: [],
    },
  });
  expect(response.status()).toBe(201);
  return { ...(await response.json()), name } as { id: string; name: string };
}

async function importCsv(page: Page, filename: string, content: string) {
  await page.getByLabel('Select a file').setInputFiles({
    name: filename,
    mimeType: 'text/csv',
    buffer: Buffer.from(content),
  });
  await page.getByRole('button', { name: 'Preview file' }).click();
  await expect(
    page.getByRole('table', { name: 'Import preview' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Import dataset', exact: true })
    .click();
  await expect(
    page.getByRole('table', { name: 'Dataset rows and columns' }),
  ).toBeVisible();
}

async function setComparisonMetadata(page: Page) {
  await page.getByLabel('Meaning').fill('audience reach');
  await page.getByLabel('Unit').fill('people');
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/columns') &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save labels', exact: true }).click();
  expect((await saved).ok()).toBe(true);
  await page
    .getByRole('button', { name: 'Back to campaign data' })
    .click({ timeout: 10000 });
}

test('separate datasets compare original values and export independently', async ({
  page,
}) => {
  await signIn(page);
  const campaign = await createCampaign(page);
  await page.goto(`/?campaignId=${campaign.id}#datasets`);
  await expect(
    page.getByRole('combobox', { name: 'Campaign', exact: true }),
  ).toHaveValue(campaign.id);

  await importCsv(
    page,
    'first-source.csv',
    'Date,Reach\n2026-03-01,100\n2026-03-02,120\n',
  );
  await setComparisonMetadata(page);
  await importCsv(
    page,
    'second-source.csv',
    'Date,Reach\n2026-03-01,80\n2026-03-02,95\n',
  );
  await setComparisonMetadata(page);

  const list = page.getByRole('region', { name: 'Campaign datasets' });
  await expect(list.getByRole('article')).toHaveCount(2);
  await page.getByText('Compare two columns', { exact: true }).click();
  await expect(page.getByText(/shared chart is available/i)).toBeVisible();
  await expect(
    page.getByRole('img', {
      name: 'Shared time-series chart of selected source values',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'First dataset comparison rows' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Second dataset comparison rows' }),
  ).toBeVisible();
  const comparisonDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export comparison PDF' }).click();
  const comparisonPdf = await comparisonDownload;
  expect(await comparisonPdf.failure()).toBeNull();
  expect(
    (await readFile((await comparisonPdf.path())!).catch(() => Buffer.alloc(0)))
      .subarray(0, 5)
      .toString('ascii'),
  ).toBe('%PDF-');

  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Campaign', exact: true })
    .selectOption(campaign.id);
  await expect(
    page.getByRole('heading', { name: 'Reports by dataset' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'second-source' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'first-source' }),
  ).toBeVisible();
  await expect(
    page.getByText(/No columns are added together across files/),
  ).toBeVisible();
});

test('Management can inspect dataset data while upload and mutations remain unavailable', async ({
  page,
}) => {
  await signIn(page, 'management');
  await expect(page.getByLabel('Select a file')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Create campaign' }),
  ).toHaveCount(0);
  await expect(page.getByLabel('Metric', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
});
