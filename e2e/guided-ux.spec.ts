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
    page.getByText('View source rows', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Dataset rows and columns' }),
  ).not.toBeVisible();
  await page.getByText('View source rows', { exact: true }).click();
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
  await page
    .getByRole('button', { name: 'Save column details', exact: true })
    .click();
  expect((await saved).ok()).toBe(true);
  await page
    .getByRole('button', { name: 'Back to campaign data' })
    .click({ timeout: 10000 });
}

test('timestamp exports appear joined by date when opening a campaign', async ({
  page,
}) => {
  await signIn(page);
  const campaign = await createCampaign(page);
  await page.goto(`/?campaignId=${campaign.id}#datasets`);
  await importCsv(
    page,
    'clicks.csv',
    'Date,Clicks\n2026-01-01T01:00:00,3\n2026-01-02T01:00:00,4\n',
  );
  await page.getByRole('button', { name: 'Back to campaign data' }).click();
  await importCsv(
    page,
    'follows.csv',
    'Date,Follows\n2026-01-01T01:00:00,8\n2026-01-02T01:00:00,9\n',
  );
  await page.goto(`/?campaignId=${campaign.id}#campaigns`);
  await page.getByRole('button', { name: campaign.name, exact: true }).click();
  const table = page.getByRole('table', { name: 'Datasets joined by date' });
  await expect(table).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table.getByRole('row').nth(1)).toContainText('2026-01-01');
  await expect(table.getByRole('row').nth(1)).toContainText('3');
  await expect(table.getByRole('row').nth(1)).toContainText('8');
  await expect(
    page.getByLabel('Date column 1', { exact: true }),
  ).not.toBeVisible();
  await expect(page.locator('.dataset-workspace')).toHaveCount(0);
});

test('joined view charts and prints all rows while imports remain separate', async ({
  page,
}, testInfo) => {
  await signIn(page);
  const campaign = await createCampaign(page);
  await page.goto(`/?campaignId=${campaign.id}#datasets`);
  await expect(
    page.getByRole('combobox', { name: 'Campaign', exact: true }),
  ).toHaveValue(campaign.id);

  await importCsv(
    page,
    'first-source.csv',
    `Date,Reach\n${Array.from({ length: 26 }, (_, index) => `2026-03-${String(index + 1).padStart(2, '0')},${index === 0 ? 100 : index === 1 ? 120 : index + 200}`).join('\n')}\n`,
  );
  await setComparisonMetadata(page);
  await importCsv(
    page,
    'second-source.csv',
    'Date,Reach\n2026-03-01,80\n2026-03-02,95\n',
  );
  await setComparisonMetadata(page);
  await importCsv(
    page,
    'third-source.csv',
    'Date,Impressions\n2026-03-01,250\n2026-03-02,300\n',
  );
  await setComparisonMetadata(page);

  const list = page.getByRole('region', { name: 'Campaign datasets' });
  await expect(list.getByRole('article')).toHaveCount(3);
  await page.getByText('Join datasets by date', { exact: true }).click();
  const joinedTable = page.getByRole('table', {
    name: 'Datasets joined by date',
  });
  await expect(joinedTable).toBeVisible();
  await expect(joinedTable.getByRole('columnheader')).toHaveCount(4);
  const joinedHeaders = await joinedTable
    .getByRole('row')
    .first()
    .getByRole('columnheader')
    .allTextContents();
  const joinedCells = await joinedTable
    .getByRole('row')
    .nth(1)
    .getByRole('cell')
    .allTextContents();
  const joinedValues = Object.fromEntries(
    joinedHeaders
      .slice(1)
      .map((header, index) => [header, joinedCells[index + 1]]),
  );
  expect(joinedCells[0]).toBe('2026-03-01');
  expect(joinedValues['first-source · Reach']).toBe('100');
  expect(joinedValues['second-source · Reach']).toBe('80');
  expect(joinedValues['third-source · Impressions']).toBe('250');
  const joinedDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download joined CSV' }).click();
  const joinedCsv = await joinedDownload;
  expect(await joinedCsv.failure()).toBeNull();
  const joinedCsvContents = await readFile((await joinedCsv.path())!, 'utf8');
  const joinedCsvRow = joinedCsvContents
    .split(/\r?\n/)
    .find((line) => line.startsWith('"2026-03-01"'));
  expect(joinedCsvRow).toBeTruthy();
  for (const value of Object.values(joinedValues)) {
    expect(joinedCsvRow).toContain(`"${value}"`);
  }
  await expect(
    page.getByText('Compare two columns', { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel('Chart by date')
    .selectOption({ label: 'first-source · Reach' });
  await expect(
    page.getByRole('img', { name: 'Chart of first-source · Reach by date' }),
  ).toBeVisible();
  await expect(joinedTable.getByRole('row')).toHaveCount(26);
  const printable = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Print / Save PDF' }).click();
  const printPage = await printable;
  const printTable = printPage.getByRole('table', {
    name: 'Joined campaign data',
  });
  await expect(printTable.getByRole('row')).toHaveCount(27);
  await expect(printTable.getByRole('row').last()).toContainText('2026-03-26');
  await expect(printTable.getByRole('row').last()).toContainText('225');
  await expect(printPage.locator('svg')).toBeVisible();
  await testInfo.attach('joined-print-preview', {
    body: await printPage.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
  const pdf = await printPage.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
  });
  expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  await testInfo.attach('joined-campaign-report', {
    body: pdf,
    contentType: 'application/pdf',
  });
  await printPage.close();

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

test('dataset column details clearly track pending, saved, and failed edits', async ({
  page,
}) => {
  await signIn(page);
  const campaign = await createCampaign(page);
  await page.goto(`/?campaignId=${campaign.id}#datasets`);
  await importCsv(
    page,
    'column-details.csv',
    'Date,Reach\n2026-03-01,100\n2026-03-02,120\n',
  );
  const chart = page.locator('.dataset-chart');
  await expect(chart.getByText('Date', { exact: true })).toBeVisible();
  await expect(chart.getByText('Reach', { exact: true }).first()).toBeVisible();
  const meaningField = page.getByLabel('Meaning');
  await expect
    .poll(() =>
      meaningField.evaluate((element) => getComputedStyle(element).borderWidth),
    )
    .toBe('1px');
  await meaningField.focus();
  await expect
    .poll(() =>
      meaningField.evaluate(
        (element) => getComputedStyle(element).outlineWidth,
      ),
    )
    .toBe('3px');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page
        .locator('.dataset-label-actions')
        .evaluate((element) => getComputedStyle(element).flexWrap),
    )
    .toBe('wrap');
  await page.setViewportSize({ width: 1440, height: 900 });

  const save = page.getByRole('button', {
    name: 'Save column details',
    exact: true,
  });
  await expect(page.getByText('Dataset saved · 2 rows')).toBeVisible();
  await expect(page.getByText('No unsaved changes')).toBeVisible();
  await expect(save).toBeDisabled();

  const meaning = page.getByLabel('Meaning');
  await meaning.fill('audience reach');
  await expect(page.getByText('Unsaved changes')).toBeVisible();
  await expect(save).toBeEnabled();
  await meaning.fill('');
  await expect(page.getByText('No unsaved changes')).toBeVisible();
  await expect(save).toBeDisabled();

  await meaning.fill('audience reach');
  await page.getByLabel('Unit').fill('people');
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/columns') &&
      response.request().method() === 'PATCH',
  );
  await save.click();
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText('Changes saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Meaning')).toHaveValue('audience reach');
  await expect(page.getByLabel('Unit')).toHaveValue('people');
  await expect(page.getByText('No unsaved changes')).toBeVisible();

  let markDelayedRequest!: () => void;
  const delayedRequestStarted = new Promise<void>((resolve) => {
    markDelayedRequest = resolve;
  });
  let releaseDelayedResponse!: () => void;
  const delayedResponseReleased = new Promise<void>((resolve) => {
    releaseDelayedResponse = resolve;
  });
  await page.route('**/columns', async (route) => {
    if (route.request().method() === 'PATCH') {
      markDelayedRequest();
      await delayedResponseReleased;
    }
    await route.continue();
  });
  await meaning.fill('audience reach edited');
  const delayedSave = page.waitForResponse(
    (response) =>
      response.url().includes('/columns') &&
      response.request().method() === 'PATCH',
  );
  await save.click();
  await delayedRequestStarted;
  try {
    await expect(page.getByText('Saving…').first()).toBeVisible();
    await expect(page.locator('.dataset-label-actions button')).toBeDisabled();
    await expect(meaning).toBeDisabled();
  } finally {
    releaseDelayedResponse();
  }
  expect((await delayedSave).ok()).toBe(true);
  await expect(page.getByText('Changes saved')).toBeVisible();

  await page.route('**/columns', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 500, body: 'save failed' });
      return;
    }
    await route.continue();
  });
  await meaning.fill('updated reach');
  await save.click();
  await expect(page.getByText('Changes not saved')).toBeVisible();
  await expect(meaning).toHaveValue('updated reach');
  await expect(save).toBeEnabled();
});

test('campaign data workspace opens on request and omits empty channel cards', async ({
  page,
}) => {
  await signIn(page);
  const campaign = await createCampaign(page);
  await page.goto('/#campaigns');
  await page.reload();
  await page.getByRole('button', { name: campaign.name, exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'Manage campaign files' }),
  ).toBeVisible();
  await expect(page.locator('.dataset-workspace')).toHaveCount(0);
  await expect(
    page.locator('.detail-grid dt', { hasText: 'Channels' }),
  ).toHaveCount(0);
  await expect(
    page.locator('.detail-grid dt', { hasText: 'Platforms' }),
  ).toHaveCount(0);

  await page.getByRole('button', { name: 'Manage campaign files' }).click();
  await expect(page.locator('.dataset-workspace')).toBeVisible();
  await page.getByRole('button', { name: 'Back to campaign data' }).click();
  await expect(page.locator('.dataset-workspace')).toHaveCount(0);
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
