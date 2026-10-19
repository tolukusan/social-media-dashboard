import { openSectionItem } from './navigation-helpers';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function showMoreFilters(page: Page) {
  const details = page.locator('details.filter-disclosure');
  if ((await details.getAttribute('open')) === null)
    await details.locator('summary').click();
}

test('unauthenticated users see login before protected data requests', async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/')) apiRequests.push(request.url());
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  expect(apiRequests.some((url) => url.includes('/auth/me'))).toBe(true);
  expect(
    apiRequests.some((url) =>
      /analytics|campaigns|performance-records/.test(url),
    ),
  ).toBe(false);
});

test('screen navigation keeps six primary sections, file-first data, and session recovery', async ({
  page,
}) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error(
      'Navigation E2E requires the isolated Administrator fixture.',
    );
  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  await expect(navigation.locator(':scope > button')).toHaveText([
    'Overview',
    'Accounts',
    'Campaigns',
    'Data',
    'Reports',
    'Administration',
  ]);
  await expect(
    page.getByRole('combobox', { name: 'Campaign', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Select a file')).toBeVisible();
  await expect(page.getByLabel('Metric', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Channel', { exact: true })).toHaveCount(0);
  for (const width of [1600, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const pageWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(
      pageWidth,
      `horizontal overflow at ${width}px viewport`,
    ).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const [section, title] of [
    ['Campaigns', 'Campaigns'],
    ['Data', 'Data'],
    ['Reports', 'Reports'],
    ['Administration', 'Settings'],
  ]) {
    await navigation
      .getByRole('button', { name: section, exact: true })
      .click();
    await expect(page.locator('h1')).toHaveText(title);
  }
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Reports');
  await page.goForward();
  await expect(page.locator('h1')).toHaveText('Settings');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Settings');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close menu' }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Data', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Data');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Imports', exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 720 });

  let release!: () => void;
  let started!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requested = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route('**/api/v1/auth/me', async (route) => {
    started();
    await pending;
    await route.continue();
  });
  const checked = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/me') && response.status() === 200,
  );
  try {
    await page.getByRole('link', { name: 'Imports', exact: true }).click();
    await requested;
    await expect(page.locator('h1')).toHaveText('Data');
  } finally {
    release();
  }
  await checked;
  await navigation
    .getByRole('button', { name: 'Overview', exact: true })
    .click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.unroute('**/api/v1/auth/me');
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Session expired' }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('heading', {
      name: 'Sign in to your workspace',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Import performance data', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/v1/auth/me');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace' }),
  ).toBeVisible();
});

test('performance record pages keep filtering across the full list', async ({
  page,
}) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error(
      'Pagination E2E requires the isolated Administrator fixture.',
    );
  await page.route('**/api/v1/performance-records', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(
        Array.from({ length: 105 }, (_, index) => ({
          id: `pagination-${index}`,
          recordDate: '2026-01-01T00:00:00.000Z',
          campaignPlatform: {
            campaignChannel: {
              campaign: { name: `Pagination campaign ${index + 1}` },
              channel: { name: 'Social Media Marketing' },
            },
            platform: { name: 'Facebook' },
          },
          metricValues: [],
        })),
      ),
    }),
  );
  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await openSectionItem(page, 'Data', 'Performance data');
  const table = page.getByRole('table', { name: 'Performance record list' });
  await expect(table.getByRole('row')).toHaveCount(51);
  await expect(page.getByText('Showing 1–50 of 105 records')).toBeVisible();
  await page.getByRole('button', { name: 'Next records' }).click();
  await expect(page.getByText('Showing 51–100 of 105 records')).toBeVisible();
  await page.getByRole('button', { name: 'Next records' }).click();
  await expect(table.getByRole('row')).toHaveCount(6);
  await page
    .getByLabel('Search performance records')
    .fill('Pagination campaign 105');
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(page.getByText('Showing 1–1 of 1 records')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Previous records' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Next records' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
});

test('authenticated user can create a platform-free campaign, inspect a dataset, and export it', async ({
  page,
}) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error(
      'Authenticated smoke requires the isolated Administrator fixture.',
    );
  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Create campaign' }).click();
  const campaignName = `File-first ${Date.now()}`;
  await page.getByLabel('Campaign name').fill(campaignName);
  await page.getByLabel('Start date').last().fill('2026-01-01');
  await page
    .getByRole('button', { name: 'Create and select campaign' })
    .click();
  await expect(
    page
      .getByRole('combobox', { name: 'Campaign', exact: true })
      .locator('option:checked'),
  ).toHaveText(campaignName);

  const rows = Array.from({ length: 365 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 0, 1 + index))
      .toISOString()
      .slice(0, 10);
    return `${date},${index},${index + 1}`;
  });
  const csv = Buffer.from(`Date,Visits,Visits\n${rows.join('\n')}\n`);
  await page.getByLabel('Select a file').setInputFiles({
    name: 'annual-export.csv',
    mimeType: 'text/csv',
    buffer: csv,
  });
  await expect(
    page.getByRole('button', { name: 'Preview file' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Preview file' }).click();
  await expect(
    page.getByText('365 rows', { exact: false }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Import preview' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Import dataset', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'annual-export', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('View source rows', { exact: true }),
  ).toBeVisible();
  if (
    !(await page
      .getByRole('table', { name: 'Dataset rows and columns' })
      .isVisible())
  ) {
    await page.getByText('View source rows', { exact: true }).click();
  }
  await expect(page.getByText('365 matching rows · page 1 of 8')).toBeVisible();
  const table = page.getByRole('table', { name: 'Dataset rows and columns' });
  await expect(table.getByRole('row')).toHaveCount(51);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Showing rows 51–100 of 365')).toBeVisible();
  await page.getByLabel('Date column').selectOption('c1');
  await page.getByLabel('From').fill('2026-01-03');
  await page.getByLabel('To').fill('2026-01-04');
  await expect(
    page.getByText('View source rows', { exact: true }),
  ).toBeVisible();
  if (
    !(await page
      .getByRole('table', { name: 'Dataset rows and columns' })
      .isVisible())
  ) {
    await page.getByText('View source rows', { exact: true }).click();
  }
  await expect(page.getByText('2 matching rows · page 1 of 1')).toBeVisible();

  const csvDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export filtered rows as CSV' })
    .click();
  expect((await csvDownload).suggestedFilename()).toContain('.csv');
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export dataset as PDF' }).click();
  const pdf = await pdfDownload;
  expect(await pdf.failure()).toBeNull();
  expect(
    (await readFile((await pdf.path())!)).subarray(0, 5).toString('ascii'),
  ).toBe('%PDF-');

  await page.goBack();
  await expect(
    page.getByRole('heading', { name: 'Datasets', exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'annual-export', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reports by dataset' }),
  ).toBeVisible();
  await expect(
    page.getByText('separate dataset report', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace' }),
  ).toBeVisible();
});

test('Administrator can manage the channel and platform catalogue lifecycle', async ({
  page,
}) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error('Catalogue E2E requires the local Administrator fixture.');

  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await openSectionItem(page, 'Administration', 'Settings');
  const currencySelect = page.getByLabel('Reporting currency');
  const originalCurrency = await currencySelect.inputValue();
  const changedCurrency = originalCurrency === 'NGN' ? 'USD' : 'NGN';
  await currencySelect.selectOption(changedCurrency);
  await page.getByRole('button', { name: 'Save reporting currency' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Reporting currency saved.' })
      .first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Settings');
  await openSectionItem(page, 'Administration', 'Settings');
  await expect(page.getByLabel('Reporting currency')).toHaveValue(
    changedCurrency,
  );
  if (originalCurrency) {
    await page.getByLabel('Reporting currency').selectOption(originalCurrency);
    await page.getByRole('button', { name: 'Save reporting currency' }).click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Reporting currency saved.' })
        .first(),
    ).toBeVisible();
  }
  await expect(
    page.getByRole('heading', { name: 'Channels & Platforms' }),
  ).toBeVisible();

  const suffix = Date.now().toString().slice(-8);
  const channelName = `E2E Channel ${suffix}`;
  const channelCode = `E2E_${suffix}`;
  await page.getByLabel('Channel name').first().fill(channelName);
  await page.getByLabel('Channel code').first().fill(channelCode);
  await page.getByRole('button', { name: 'Add channel' }).click();

  const channelCard = page
    .locator('article.catalogue-channel')
    .filter({ hasText: channelName });
  await expect(channelCard).toContainText('Active');

  const platformName = `E2E Platform ${suffix}`;
  await page.getByLabel('Platform name').first().fill(platformName);
  await page.getByLabel('Platform code').first().fill(`PLAT_${suffix}`);
  const platformForm = page
    .getByRole('heading', { name: 'Add platform' })
    .locator('xpath=following-sibling::form[1]');
  await platformForm.locator('select[name="channelId"]').selectOption({
    label: channelName,
  });
  await platformForm.getByRole('button', { name: 'Add platform' }).click();
  await expect(channelCard).toContainText(platformName);

  await channelCard.getByRole('button', { name: 'Edit' }).first().click();
  const renamedChannel = `${channelName} Updated`;
  const channelEditForm = page
    .getByRole('button', { name: 'Save channel' })
    .locator('..');
  await channelEditForm.getByLabel('Channel name').fill(renamedChannel);
  await channelEditForm.getByRole('button', { name: 'Save channel' }).click();
  const renamedCard = page
    .locator('article.catalogue-channel')
    .filter({ hasText: renamedChannel });
  await expect(renamedCard).toContainText(renamedChannel);

  const platformRow = renamedCard
    .locator('.catalogue-platform')
    .filter({ hasText: platformName });
  await platformRow.getByRole('button', { name: 'Deactivate' }).click();
  await expect(platformRow).toContainText('Inactive');
  await platformRow.getByRole('button', { name: 'Reactivate' }).click();
  await expect(platformRow).toContainText('Active');
  await renamedCard.getByRole('button', { name: 'Deactivate' }).first().click();
  await expect(renamedCard).toContainText('Inactive');
});

test('keyboard and mobile basics remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace' }),
  ).toBeVisible();

  await page.keyboard.press('Tab');
  const firstFocus = await page.evaluate(() => document.activeElement?.tagName);
  expect(firstFocus).not.toBe('BODY');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Forgot password?' }),
  ).toBeVisible();

  await page.getByLabel('Email address').fill('missing@example.invalid');
  await page.getByLabel('Password').fill('invalid-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.notice.error[role="alert"]')).toContainText(
    'Invalid email or password',
  );
});

test('Administrator replaces, deletes, and reimports an independent dataset from the UI', async ({
  page,
}) => {
  page.on('response', (response) => {
    if (!response.url().includes('/datasets/') || response.status() < 400)
      return;
    void response.text().then((body) => {
      console.log(
        `Dataset API failure ${response.status()} ${response.url()}: ${body}`,
      );
    });
  });
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error(
      'Dataset lifecycle E2E requires the local Administrator fixture.',
    );
  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Create campaign' }).click();
  const campaignName = `Dataset lifecycle ${Date.now()}`;
  await page.getByLabel('Campaign name').fill(campaignName);
  await page.getByLabel('Start date').last().fill('2026-02-01');
  await page
    .getByRole('button', { name: 'Create and select campaign' })
    .click();
  await expect(
    page
      .getByRole('combobox', { name: 'Campaign', exact: true })
      .locator('option:checked'),
  ).toHaveText(campaignName);

  const original = Buffer.from('Date,Visits\n2026-02-01,10\n2026-02-02,12\n');
  await page.getByLabel('Select a file').setInputFiles({
    name: 'lifecycle.csv',
    mimeType: 'text/csv',
    buffer: original,
  });
  await expect(
    page.getByRole('button', { name: 'Preview file' }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Preview file' }).click();
  await page
    .getByRole('button', { name: 'Import dataset', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'lifecycle', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('View source rows', { exact: true }),
  ).toBeVisible();
  if (
    !(await page
      .getByRole('table', { name: 'Dataset rows and columns' })
      .isVisible())
  ) {
    await page.getByText('View source rows', { exact: true }).click();
  }
  await expect(page.getByText('2 matching rows · page 1 of 1')).toBeVisible();

  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.getByLabel('Upload replacement file').setInputFiles({
    name: 'corrected.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'Date,Visits\n2026-02-01,20\n2026-02-02,22\n2026-02-03,24\n',
    ),
  });
  await page.getByRole('button', { name: 'Preview file' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Confirm replacement' }).click();
  await expect(
    page.getByRole('heading', { name: 'lifecycle', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('View source rows', { exact: true }),
  ).toBeVisible();
  if (
    !(await page
      .getByRole('table', { name: 'Dataset rows and columns' })
      .isVisible())
  ) {
    await page.getByText('View source rows', { exact: true }).click();
  }
  await expect(page.getByText('3 matching rows · page 1 of 1')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'No datasets in this campaign yet' }),
  ).toBeVisible();
  await page.getByLabel('Select a file').setInputFiles({
    name: 'lifecycle.csv',
    mimeType: 'text/csv',
    buffer: original,
  });
  await page.getByRole('button', { name: 'Preview file' }).click();
  await expect(page.getByText(/already in this campaign/)).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Import dataset', exact: true })
    .click();
  await expect(
    page.getByText('View source rows', { exact: true }),
  ).toBeVisible();
  if (
    !(await page
      .getByRole('table', { name: 'Dataset rows and columns' })
      .isVisible())
  ) {
    await page.getByText('View source rows', { exact: true }).click();
  }
  await expect(page.getByText('2 matching rows · page 1 of 1')).toBeVisible();

  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Reports by dataset' }),
  ).toBeVisible();
  await expect(page.getByText('lifecycle', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
});

test('password reset keeps the token after a retryable failure', async ({
  page,
}) => {
  const token = 'A'.repeat(43);
  let resetAttempts = 0;
  await page.route('**/api/v1/auth/reset-password', async (route) => {
    if (route.request().method() === 'POST' && resetAttempts++ === 0) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto(`/reset-password#token=${token}`);
  await expect(page).not.toHaveURL(/#token=/);
  await page
    .getByLabel('New password', { exact: true })
    .fill('Replacement-Passphrase-2026');
  await page
    .getByLabel('Confirm new password', { exact: true })
    .fill('Replacement-Passphrase-2026');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.locator('.notice.error[role="alert"]')).toContainText(
    'We could not update your password. Please try again.',
  );
  await expect(
    page.getByRole('button', { name: 'Update password' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.locator('.notice.error[role="alert"]')).toContainText(
    'This password reset link is invalid or has expired.',
  );
  await expect(
    page.getByRole('button', { name: 'Update password' }),
  ).toHaveCount(0);
});

test('all fixed roles authenticate and dataset capabilities remain role-specific', async ({
  page,
}) => {
  const fixtures = JSON.parse(
    await readFile('apps/api/.e2e-credentials', 'utf8').catch(() => {
      throw new Error(
        'Run pnpm test:e2e:prepare against the isolated test database first.',
      );
    }),
  ) as Record<string, { email: string; password: string }>;
  for (const [key, roleName] of [
    ['administrator', 'Administrator'],
    ['marketingOfficer', 'Marketing Officer'],
    ['management', 'Management'],
  ]) {
    const account = fixtures[key];
    if (!account) throw new Error(`Missing isolated ${roleName} E2E account.`);
    await page.goto('/');
    await page.getByLabel('Email address').fill(account.email);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.locator('.sidebar-footer')).toContainText(roleName);
    const primary = page.getByRole('navigation', {
      name: 'Primary navigation',
    });
    await expect(primary.locator(':scope > button')).toHaveText([
      'Overview',
      'Accounts',
      'Campaigns',
      'Data',
      'Reports',
      'Administration',
    ]);
    await primary.getByRole('button', { name: 'Data', exact: true }).click();
    if (roleName === 'Management') {
      await expect(
        page.getByRole('button', { name: 'Create campaign' }),
      ).toHaveCount(0);
      await expect(page.getByLabel('Select a file')).toHaveCount(0);
    } else {
      await expect(
        page.getByRole('button', { name: 'Create campaign' }),
      ).toBeVisible();
      await expect(page.getByLabel('Select a file')).toBeVisible();
    }
    await primary
      .getByRole('button', { name: 'Campaigns', exact: true })
      .click();
    const campaignCreate = page.getByRole('button', { name: '+ New campaign' });
    if (roleName === 'Management') await expect(campaignCreate).toHaveCount(0);
    else await expect(campaignCreate).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Sign in to your workspace' }),
    ).toBeVisible();
  }
});
