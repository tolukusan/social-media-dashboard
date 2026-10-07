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
  const comparisonName = `${originalName} Comparison`;
  await page.getByRole('button', { name: '+ New campaign' }).click();
  await page.getByLabel('Campaign name').fill(comparisonName);
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

  await page.getByRole('button', { name: 'KPI targets' }).click();
  const definitionSelect = page.getByLabel('KPI definition');
  const definitionOption = definitionSelect.locator('option').nth(1);
  const definitionValue = (await definitionOption.getAttribute('value')) ?? '';
  const definitionLabel = (await definitionOption.innerText()).trim();
  await definitionSelect.selectOption(definitionValue);
  await page.getByLabel('Target period').selectOption('DAILY');
  await page.getByLabel('Target value').fill('1');
  await page.getByLabel('Target scope').selectOption('CAMPAIGN');
  const targetCampaign = page.getByLabel('Target campaign');
  const targetCampaignOption = targetCampaign
    .locator('option')
    .filter({ hasText: updatedName });
  await targetCampaign.selectOption(
    (await targetCampaignOption.getAttribute('value')) ?? '',
  );
  await page.getByLabel('Target effective from').fill(recordDate);
  await page.getByRole('button', { name: 'Create target' }).click();
  const targetRow = page.getByRole('row').filter({ hasText: definitionLabel });
  await expect(targetRow).toContainText('1');
  await targetRow.getByRole('button', { name: 'Edit/end date' }).click();
  await page.getByLabel('Target value').fill('2');
  await page.getByLabel('Target effective to').fill(recordDate);
  await page.getByRole('button', { name: 'Save target' }).click();
  await expect(targetRow).toContainText('2');

  await page.getByRole('button', { name: 'Overview' }).click();
  await page.getByLabel('From').fill(recordDate);
  await page.getByLabel('To').fill(recordDate);
  const refreshedCampaignFilter = page.getByLabel('Campaign', { exact: true });
  const refreshedCampaignOption = refreshedCampaignFilter
    .locator('option')
    .filter({ hasText: updatedName });
  await refreshedCampaignFilter.selectOption(
    (await refreshedCampaignOption.getAttribute('value')) ?? '',
  );
  const refreshedMetric = page.getByLabel('Metric', { exact: true });
  const targetMetricOption = refreshedMetric
    .locator('option')
    .filter({ hasText: definitionLabel });
  await refreshedMetric.selectOption(
    (await targetMetricOption.getAttribute('value')) ?? '',
  );
  await page.getByLabel('Target period').selectOption('DAILY');
  const evaluationTable = page
    .getByRole('heading', { name: 'Target evaluation' })
    .locator('..')
    .locator('..')
    .getByRole('table');
  await expect(evaluationTable).toContainText(definitionLabel);
  await expect(evaluationTable).toContainText('2');
  await expect(evaluationTable).not.toContainText(
    'Status rule requires clarification',
  );

  await page.getByRole('button', { name: 'Analytics', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Period comparison' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Campaign or channel comparison' }),
  ).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible();
  await page.getByLabel('Compare').last().selectOption('CAMPAIGN');
  const firstCampaign = page.getByLabel('First campaign');
  const secondCampaign = page.getByLabel('Second campaign');
  const firstOption = firstCampaign
    .locator('option')
    .filter({ hasText: updatedName });
  await firstCampaign.selectOption(
    (await firstOption.getAttribute('value')) ?? '',
  );
  const secondOption = secondCampaign
    .locator('option')
    .filter({ hasText: comparisonName });
  await secondCampaign.selectOption(
    (await secondOption.getAttribute('value')) ?? '',
  );
  const comparisonTable = page.getByRole('table').nth(1);
  await expect(comparisonTable).toContainText(updatedName);
  await expect(comparisonTable).toContainText(comparisonName);
  await expect(comparisonTable.getByRole('row')).toHaveCount(3);
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

test('Administrator can manage the channel and platform catalogue lifecycle', async ({
  page,
}) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error('Catalogue E2E requires the local Administrator fixture.');

  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
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
  await page
    .getByLabel('Channel', { exact: true })
    .first()
    .selectOption({ label: channelName });
  await page.getByRole('button', { name: 'Add platform' }).click();
  await expect(channelCard).toContainText(platformName);

  await channelCard.getByRole('button', { name: 'Edit' }).first().click();
  const renamedChannel = `${channelName} Updated`;
  await channelCard.getByLabel('Channel name').fill(renamedChannel);
  await channelCard.getByRole('button', { name: 'Save channel' }).click();
  await expect(channelCard).toContainText(renamedChannel);

  const platformRow = channelCard
    .locator('.catalogue-platform')
    .filter({ hasText: platformName });
  await platformRow.getByRole('button', { name: 'Deactivate' }).click();
  await expect(platformRow).toContainText('Inactive');
  await platformRow.getByRole('button', { name: 'Reactivate' }).click();
  await expect(platformRow).toContainText('Active');
  await channelCard.getByRole('button', { name: 'Deactivate' }).first().click();
  await expect(channelCard).toContainText('Inactive');
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
  await expect(page.getByRole('alert')).toContainText(
    'Invalid email or password',
  );
});

test('Administrator can preview, validate, and confirm a structured import', async ({
  page,
}) => {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD)
    throw new Error(
      'Structured import E2E requires the local Administrator fixture.',
    );

  await page.goto('/');
  await page.getByLabel('Email address').fill(process.env.E2E_EMAIL);
  await page.getByLabel('Password').fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/imports');

  const fixture = await readFile(
    'apps/api/test-fixtures/imports/facebook-views.csv',
    'utf8',
  );
  const uniqueFixture = fixture.replace(
    '2170',
    String(100_000 + (Date.now() % 800_000)),
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: `e2e-facebook-${Date.now()}.csv`,
    mimeType: 'text/csv',
    buffer: Buffer.from(uniqueFixture),
  });
  await page.getByRole('button', { name: 'Upload and preview' }).click();
  await expect(page.getByRole('heading', { name: '2. Preview' })).toBeVisible();

  const importName = `E2E Import ${Date.now()}`;
  await page.getByLabel('Dataset/import name').fill(importName);

  const platform = page
    .locator('.import-context select')
    .filter({ has: page.locator('option', { hasText: 'Facebook' }) })
    .first();
  const facebookOption = platform
    .locator('option')
    .filter({ hasText: 'Facebook' });
  await platform.selectOption(
    (await facebookOption.getAttribute('value')) ?? '',
  );

  await page.getByRole('button', { name: '+ Create new campaign' }).click();
  const campaignName = `E2E Import Campaign ${Date.now()}`;
  await page.getByRole('dialog').getByLabel('Campaign name').fill(campaignName);
  await page.getByRole('dialog').getByLabel('Start date').fill('2026-01-01');
  await page.getByRole('dialog').getByLabel('End date').fill('2026-01-02');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create and return to import' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByRole('button', { name: 'Validate rows' }).click();
  await expect(
    page.getByRole('heading', { name: '4. Validation and confirmation' }),
  ).toBeVisible();
  await expect(page.getByText('Accepted: 2')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm import' }).click();
  await expect(page.getByRole('status')).toContainText('Import completed');

  const historyRow = page.getByRole('row').filter({ hasText: importName });
  await expect(historyRow).toContainText('COMPLETED');
  await expect(historyRow).toContainText('2/2 accepted');
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
  await page.getByLabel('New password').fill('Replacement-Passphrase-2026');
  await page
    .getByLabel('Confirm new password')
    .fill('Replacement-Passphrase-2026');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'We could not update your password. Please try again.',
  );
  await expect(
    page.getByRole('button', { name: 'Update password' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'This password reset link is invalid or has expired.',
  );
  await expect(
    page.getByRole('button', { name: 'Update password' }),
  ).toHaveCount(0);
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
