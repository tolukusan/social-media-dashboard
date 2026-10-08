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

test('screen navigation preserves the session while rechecking it and rejects an expired session', async ({
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
  await expect(page.getByLabel('Campaign', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading workspace data' }),
  ).toHaveCount(0, { timeout: 30_000 });
  await page.getByLabel('Campaign', { exact: true }).evaluate((select) => {
    const option = select.querySelector('option');
    if (option) option.textContent = 'A long campaign name '.repeat(25);
  });
  await expect(page.getByLabel('Channel', { exact: true })).not.toBeVisible();
  await showMoreFilters(page);
  for (const width of [1600, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    for (const label of [
      'From',
      'To',
      'Campaign',
      'Channel',
      'Platform',
      'Metric',
      'Target period',
    ]) {
      const bounds = await page
        .getByLabel(label, { exact: true })
        .boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    Reflect.set(window, '__navigationMarker', true);
    Reflect.set(window, '__sessionLoaderSeen', false);
    new MutationObserver(() => {
      if (document.querySelector('h1')?.textContent === 'Checking your session')
        Reflect.set(window, '__sessionLoaderSeen', true);
    }).observe(document, { childList: true, subtree: true });
  });
  for (const name of [
    'Campaigns',
    'Performance data',
    'Analytics',
    'Reports',
    'Settings',
  ]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('h1')).toHaveText(name);
  }
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('Reports');
  await page.goForward();
  await expect(page.locator('h1')).toHaveText('Settings');
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Settings');
  // Reset the document marker after the deliberate reload above.
  await page.evaluate(() => {
    Reflect.set(window, '__navigationMarker', true);
    Reflect.set(window, '__sessionLoaderSeen', false);
    new MutationObserver(() => {
      if (document.querySelector('h1')?.textContent === 'Checking your session')
        Reflect.set(window, '__sessionLoaderSeen', true);
    }).observe(document, { childList: true, subtree: true });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Close menu' }),
  ).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Campaigns', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Campaigns');
  await expect(
    page.getByRole('button', { name: 'Menu', exact: true }),
  ).toHaveAttribute('aria-expanded', 'false');
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
    await expect(
      page.getByRole('heading', {
        name: 'Import performance data',
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => Reflect.get(window, '__navigationMarker')),
    ).toBe(true);
    expect(
      await page.evaluate(() => Reflect.get(window, '__sessionLoaderSeen')),
    ).toBe(false);
  } finally {
    release();
  }
  await checked;
  const returnedCheck = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/me') && response.status() === 200,
  );
  await page.getByRole('link', { name: 'Back to workspace' }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await returnedCheck;
  expect(
    await page.evaluate(() => Reflect.get(window, '__navigationMarker')),
  ).toBe(true);
  expect(
    await page.evaluate(() => Reflect.get(window, '__sessionLoaderSeen')),
  ).toBe(false);
  await page.unroute('**/api/v1/auth/me');
  // A cached session must still yield to a server rejection on the next screen.
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Session expired' }),
    }),
  );
  await page.getByRole('link', { name: 'Imports', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sign in required', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Import performance data', exact: true }),
  ).toHaveCount(0);
  await page.unroute('**/api/v1/auth/me');
  await page.getByRole('link', { name: 'Return to workspace' }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'Sign in to your workspace',
      exact: true,
    }),
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
  await page
    .getByRole('button', { name: 'Performance data', exact: true })
    .click();
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
  await page.getByLabel('From').fill('');
  await page.getByLabel('To').fill('');
  await expect(
    page.getByRole('status').filter({ hasText: 'Loading workspace data' }),
  ).toHaveCount(0);
  const initialCount = Number.parseInt(
    (await page.locator('span.filter.muted').innerText()).split(' ')[0],
    10,
  );
  await page.getByRole('button', { name: 'My profile' }).click();
  await expect(
    page.getByRole('heading', { name: 'My profile', level: 1 }),
  ).toBeVisible();
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
    .getByRole('checkbox', { name: 'Social Media Marketing', exact: true })
    .check();
  await page.getByRole('checkbox', { name: 'Facebook', exact: true }).check();
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
    .getByRole('checkbox', { name: 'Social Media Marketing', exact: true })
    .check();
  await page.getByRole('checkbox', { name: 'Facebook', exact: true }).check();
  await page.getByRole('button', { name: 'Create campaign' }).click();
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
  await showMoreFilters(page);
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
  const targetRow = page
    .getByRole('row')
    .filter({ hasText: definitionLabel })
    .filter({ hasText: updatedName });
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
  await showMoreFilters(page);
  const refreshedMetric = page.getByLabel('Metric', { exact: true });
  const targetMetricOption = refreshedMetric
    .locator('option')
    .filter({ hasText: definitionLabel });
  await refreshedMetric.selectOption(
    (await targetMetricOption.getAttribute('value')) ?? '',
  );
  await page.getByLabel('Target period').selectOption('DAILY');
  const evaluationTable = page
    .locator('section[aria-labelledby="target-evaluations-title"]')
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
  const downloadedReport = await reportDownload;
  expect(downloadedReport.suggestedFilename()).toMatch(
    /^marketing-performance-report_.*\.pdf$/,
  );
  expect(await downloadedReport.failure()).toBeNull();
  const downloadedPath = await downloadedReport.path();
  expect(downloadedPath).not.toBeNull();
  const downloadedBytes = await readFile(downloadedPath!);
  expect(downloadedBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(downloadedBytes.length).toBeGreaterThan(512);
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Performance' }).click();
  await performanceRow.getByRole('button', { name: 'Edit' }).click();
  await countMetric.fill('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(performanceRow).toContainText('2');
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

  await page.getByLabel('Select import file').setInputFiles({
    name: 'legacy-export.xls',
    mimeType: 'application/vnd.ms-excel',
    buffer: Buffer.from('legacy'),
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'older Excel' }),
  ).toContainText('as XLSX');
  await expect(
    page.getByRole('heading', { name: 'Import performance data' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'View import history', exact: true })
    .click();
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
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Reporting currency').selectOption('NGN');
  await page.getByRole('button', { name: 'Save reporting currency' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Reporting currency saved.' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Settings');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByLabel('Reporting currency')).toHaveValue('NGN');
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

test('Administrator follows the guided import through results, PDF, and protected history', async ({
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
  await expect(page.locator('h1')).toHaveText('Overview');
  await page.goto('/imports');
  const fixture = await readFile(
    'apps/api/test-fixtures/imports/facebook-views.csv',
    'utf8',
  );
  const uniqueFixture = fixture.replace(
    '2170',
    String(100_000 + (Date.now() % 800_000)),
  );
  const importName = 'E2E Import ' + Date.now();
  await page.getByLabel('Select import file').setInputFiles({
    name: importName + '.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(uniqueFixture),
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '2. Confirm details' }),
  ).toBeFocused();
  await expect(page.locator('.import-details-summary')).toContainText(
    'Facebook',
  );
  await expect(page.getByLabel('Dataset/import name')).toHaveCount(0);
  await page.getByRole('button', { name: '+ Create new campaign' }).click();
  const campaignName = 'E2E Import Campaign ' + Date.now();
  await page.getByRole('dialog').getByLabel('Campaign name').fill(campaignName);
  await expect(page.getByRole('dialog').getByLabel('Start date')).toHaveValue(
    '2026-01-01',
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Create and return to import' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Change details / review fields' })
    .click();
  await page.getByLabel('Dataset/import name').fill(importName);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByLabel('Dataset/import name')).toHaveValue(importName);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '3. Review and import' }),
  ).toBeVisible();
  await expect(page.getByText('Accepted: 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back / fix details' }).click();
  await page.getByLabel('Dataset/import name').fill(importName + ' revised');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Import data', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Import data', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Import complete', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'View import history' }).click();
  const historyRow = page
    .getByRole('row')
    .filter({ hasText: importName + ' revised' });
  await expect(historyRow).toContainText('COMPLETED');
  await expect(historyRow).toContainText('2/2 accepted');
  await expect(historyRow).toContainText('Retained for provenance');
  await expect(
    historyRow.getByRole('button', { name: 'Delete import', exact: true }),
  ).toHaveCount(0);
  const resultsUrl = await page
    .getByRole('link', { name: 'View results', exact: true })
    .getAttribute('href');
  await page.getByRole('link', { name: 'View results', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
  await expect(page.getByLabel('From')).toHaveValue('2026-01-01');
  await expect(page.getByLabel('To')).toHaveValue('2026-01-02');
  await expect(
    page.getByLabel('Campaign', { exact: true }).locator('option:checked'),
  ).toHaveText(campaignName);
  await expect(page.locator('span.filter.muted')).toHaveText('2 records');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const report = await downloaded;
  expect(await report.failure()).toBeNull();
  expect(
    (await readFile((await report.path())!)).subarray(0, 5).toString('ascii'),
  ).toBe('%PDF-');
  await page.getByRole('button', { name: 'Reports', exact: true }).click();
  await expect(page.getByText('Records: 2')).toBeVisible();
  await expect(page.locator('.report-preview')).toContainText(campaignName);
  expect(resultsUrl).toContain('from=2026-01-01');
  await page.goto('/imports');
  const stagedFilename = 'delete-staged-' + Date.now() + '.csv';
  await page.getByLabel('Select import file').setInputFiles({
    name: stagedFilename,
    mimeType: 'text/csv',
    buffer: Buffer.from(uniqueFixture),
  });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'already imported' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Next', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'View import history' }).click();
  const stagedRow = page.getByRole('row').filter({ hasText: stagedFilename });
  await stagedRow
    .getByRole('button', { name: 'Delete import', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Delete import?' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Delete import permanently' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    stagedRow.getByRole('button', { name: 'Delete import', exact: true }),
  ).toBeFocused();
  await stagedRow
    .getByRole('button', { name: 'Delete import', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete import permanently' }).click();
  await expect(stagedRow).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '1. Upload file' }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: 'Import and its staged rows deleted.' }),
  ).toBeVisible();
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
