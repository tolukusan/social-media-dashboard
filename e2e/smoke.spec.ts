import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

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

test('authenticated user can load views and logout', async ({ page }) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
    throw new Error(
      'Authenticated smoke requires E2E_EMAIL and E2E_PASSWORD for a local test account.',
    );
  }
  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL!);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading workspace data' }),
  ).toHaveCount(0);
  const initialCount = Number.parseInt(
    (await page.locator('span.filter.muted').innerText()).split(' ')[0],
    10,
  );
  await page.getByRole('button', { name: 'My profile' }).click();
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  await page.getByLabel('Display name').fill('E2E Profile Updated');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('.sidebar-footer')).toContainText(
    'E2E Profile Updated',
  );
  await page.getByRole('button', { name: 'KPI targets' }).click();
  await expect(
    page.getByRole('heading', { name: 'Create KPI target' }),
  ).toBeVisible();
  await expect(page.getByLabel('KPI definition')).toBeVisible();
  await page.getByRole('button', { name: 'Campaigns' }).click();
  await expect(page.locator('h1')).toHaveText('Campaigns');
  const originalName = `E2E Campaign ${Date.now()}`;
  const updatedName = `${originalName} Updated`;
  const end = new Date(Date.now() - 86_400_000);
  const start = new Date(end.getTime() - 6 * 86_400_000);
  const recordDate = end.toISOString().slice(0, 10);
  await page.getByRole('button', { name: '+ New campaign' }).click();
  await page.getByLabel('Campaign name').fill(originalName);
  await page.getByLabel('Start date').fill(start.toISOString().slice(0, 10));
  await page.getByLabel('End date').fill(end.toISOString().slice(0, 10));
  await page
    .locator('.channel-selection input[type="checkbox"]')
    .first()
    .check();
  await page
    .locator('.platform-options input[type="checkbox"]')
    .first()
    .check();
  await page.getByRole('button', { name: 'Create campaign' }).click();
  await page
    .locator('table button')
    .filter({ hasText: originalName })
    .first()
    .click();
  await page.getByRole('button', { name: 'Edit campaign' }).click();
  await page.getByLabel('Campaign name').fill(updatedName);
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByRole('button', { name: 'Save campaign' }).click();
  await expect(page.locator('.detail-heading h3')).toHaveText(updatedName);
  await page.getByRole('button', { name: 'Back to campaigns' }).click();
  await page.getByLabel('Filter by status').selectOption('ACTIVE');
  await page.getByLabel('Search campaigns').fill(updatedName);
  await expect(page.getByRole('button', { name: updatedName })).toBeVisible();
  await page.getByRole('button', { name: updatedName }).click();
  await page.getByRole('button', { name: 'Back to campaigns' }).click();
  await page.getByRole('button', { name: 'Performance' }).click();
  await page.getByRole('button', { name: '+ Add record' }).click();
  const context = page.getByLabel('Campaign · channel · platform');
  const campaignOption = context
    .locator('option')
    .filter({ hasText: updatedName });
  await context.selectOption(
    (await campaignOption.getAttribute('value')) ?? '',
  );
  await page.getByLabel('Record date').fill(recordDate);
  const countMetric = page
    .locator('fieldset.channel-selection label')
    .filter({ hasText: '(COUNT)' })
    .first()
    .locator('input[type="number"]');
  await countMetric.fill('0');
  await page.getByRole('button', { name: 'Add record', exact: true }).click();
  const performanceRow = page.getByRole('row').filter({ hasText: updatedName });
  await expect(performanceRow).toContainText('0');
  await page.getByRole('button', { name: 'Overview' }).click();
  await expect(page.locator('span.filter.muted')).toHaveText(
    `${initialCount + 1} records`,
  );
  await page.getByLabel('From').fill(recordDate);
  await page.getByLabel('To').fill(recordDate);
  const campaignFilter = page.getByLabel('Campaign', { exact: true });
  const campaignFilterOption = campaignFilter
    .locator('option')
    .filter({ hasText: updatedName });
  await campaignFilter.selectOption(
    (await campaignFilterOption.getAttribute('value')) ?? '',
  );
  const metricFilter = page.getByLabel('Metric', { exact: true });
  await metricFilter.selectOption(
    (await metricFilter.locator('option').nth(1).getAttribute('value')) ?? '',
  );
  await expect(page.locator('span.filter.muted')).toHaveText('1 records');
  await expect(page.getByRole('table').first()).toContainText(recordDate);
  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Period comparison' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Campaign or channel comparison' }),
  ).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('table').nth(1)).toBeVisible();
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Reports' }),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Report KPI summary' }),
  ).toBeVisible();
  await expect(page.getByText('Records: 1')).toBeVisible();
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  expect((await reportDownload).suggestedFilename()).toMatch(
    /^marketing-performance-report_.*\.pdf$/,
  );
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Performance' }).click();
  await performanceRow.getByRole('button', { name: 'Edit' }).click();
  await countMetric.fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(performanceRow).toContainText('2');
  page.once('dialog', (dialog) => dialog.accept());
  await performanceRow.getByRole('button', { name: 'Archive' }).click();
  await expect(performanceRow).toHaveCount(0);
  await page.getByRole('button', { name: 'Campaigns' }).click();
  await page.getByLabel('Filter by status').selectOption('ACTIVE');
  await page.getByLabel('Search campaigns').fill(updatedName);
  await page.getByRole('button', { name: updatedName }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Archive campaign' }).click();
  await expect(page.getByRole('button', { name: updatedName })).toHaveCount(0);
  await page.goto('/imports');
  await expect(
    page.getByRole('heading', { name: 'Import performance data' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Import history' }),
  ).toBeVisible();
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in to your workspace' }),
  ).toBeVisible();
});

test('all fixed roles authenticate and Management stays read-only', async ({
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
    await page.getByRole('button', { name: 'KPI targets' }).click();
    if (roleName === 'Administrator')
      await expect(
        page.getByRole('heading', { name: 'Create KPI target' }),
      ).toBeVisible();
    else {
      await expect(
        page.getByText('Targets are read-only for your role.'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Create target' }),
      ).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
    const campaignCreate = page.getByRole('button', {
      name: '+ New campaign',
    });
    if (roleName === 'Management') await expect(campaignCreate).toHaveCount(0);
    else await expect(campaignCreate).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(
      page.getByRole('heading', { name: 'Sign in to your workspace' }),
    ).toBeVisible();
  }
});
