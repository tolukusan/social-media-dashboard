import { openSectionItem } from './navigation-helpers';
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

test('Administrator can prepare a mapped connection without keys, enable scheduling, inspect blocked history, and disconnect', async ({
  page,
}, testInfo) => {
  await signIn(page);
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const me = await (await page.request.get(`${api}/auth/me`)).json();
  const channels = await (await page.request.get(`${api}/channels`)).json();
  const channel = channels.find(
    (item: { code: string }) => item.code === 'ADVERTISING',
  );
  const platform = channel.platforms.find(
    (item: { code: string }) => item.code === 'FACEBOOK_ADS',
  );
  // Reuse the browser's token: requesting another one would replace its cookie
  // while the browser API client still holds the token obtained during login.
  const csrf = (await page.context().cookies(api)).find(
    (cookie) => cookie.name === 'csrf_token',
  );
  expect(csrf).toBeDefined();
  const headers = {
    Origin: process.env.E2E_BASE_URL!,
    'x-csrf-token': csrf!.value,
  };
  const campaignResponse = await page.request.post(`${api}/campaigns`, {
    headers,
    data: {
      name: `Integration browser ${randomUUID()}`,
      startDate: '2024-01-01',
      responsibleUserId: me.id,
      channels: [{ channelId: channel.id, platformIds: [platform.id] }],
    },
  });
  expect(campaignResponse.status()).toBe(201);
  const campaign = await campaignResponse.json();
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Overview');
  await openSectionItem(page, 'Accounts', 'Connections');
  await expect(page.locator('h1')).toHaveText('Connections');
  const name = `Pending provider ${randomUUID()}`;
  await page
    .getByRole('combobox', { name: 'Provider', exact: true })
    .selectOption('FACEBOOK_ADS');
  await page.getByLabel('Integration platform').selectOption(platform.id);
  await page.getByLabel('Connection name').fill(name);
  await page.getByLabel('External account ID').fill(String(Date.now()));
  await page.getByLabel('Account currency').selectOption('NGN');
  await page
    .getByLabel('Server token reference')
    .fill(`INTEGRATION_E2E_${Date.now()}_ACCESS_TOKEN`);
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Connection saved.' }),
  ).toBeVisible();
  const card = page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
  await expect(card).toContainText('Awaiting server access token');
  await page
    .getByLabel('Local campaign platform')
    .selectOption({ label: `${campaign.name} / ${platform.name}` });
  await page.getByLabel('External campaign ID').fill('456');
  await page.getByRole('button', { name: 'Map campaign', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Campaign mapped.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sync now', exact: true }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Enable daily sync', exact: true })
    .click();
  await expect(card).toContainText('Daily sync enabled.');
  const connections = await (
    await page.request.get(`${api}/integrations`)
  ).json();
  const connection = connections.find(
    (item: { displayName: string }) => item.displayName === name,
  );
  const syncCsrf = (await page.context().cookies(api)).find(
    (cookie) => cookie.name === 'csrf_token',
  );
  expect(syncCsrf).toBeDefined();
  const blocked = await page.request.post(
    `${api}/integrations/${connection.id}/sync`,
    {
      headers: { ...headers, 'x-csrf-token': syncCsrf!.value },
      data: { from: '2024-05-01', to: '2024-05-02' },
    },
  );
  expect(blocked.status()).toBe(201);
  expect(await blocked.json()).toMatchObject({
    status: 'BLOCKED',
    errorCode: 'CREDENTIALS_REQUIRED',
  });
  await page.reload();
  await page.getByRole('button', { name: `View ${name}`, exact: true }).click();
  await expect(page.locator('table')).toContainText('Awaiting configuration');
  await expect(page.locator('table')).toContainText(
    'Awaiting server access token',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('integrations-pending-mobile.png'),
    fullPage: true,
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(
    page.getByRole('status').filter({
      hasText: 'Disconnected locally and removed the saved OAuth token.',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Resume connection', exact: true }),
  ).toBeVisible();
});

for (const role of ['marketingOfficer', 'management']) {
  test(`${role} can inspect integrations without administrative controls`, async ({
    page,
  }) => {
    await signIn(page, role);
    await openSectionItem(page, 'Accounts', 'Connections');
    await expect(
      page.getByRole('heading', { name: 'Automatic imports' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Add connection' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Save connection' }),
    ).toHaveCount(0);
  });
}
