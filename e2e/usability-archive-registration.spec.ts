import { openSectionItem } from './navigation-helpers';
import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
async function login(page: Page, email?: string, password?: string) {
  if (!email || !password) {
    const fixtures = JSON.parse(
      await readFile('apps/api/.e2e-credentials', 'utf8'),
    );
    email = fixtures.administrator.email;
    password = fixtures.administrator.password;
  }
  await page.goto('/');
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Overview');
}
async function mutate(
  page: Page,
  path: string,
  method: string,
  body?: unknown,
) {
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const csrf = (await page.context().cookies(api)).find(
    (c) => c.name === 'csrf_token',
  )!;
  return page.request.fetch(`${api}${path}`, {
    method,
    headers: { Origin: process.env.E2E_BASE_URL!, 'x-csrf-token': csrf.value },
    ...(body ? { data: body } : {}),
  });
}
test('public request waits for Administrator approval and receives the selected role', async ({
  page,
}) => {
  const email = `applicant-${randomUUID()}@example.invalid`;
  const password = randomUUID() + randomUUID();
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Browser applicant');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Submit access request' }).click();
  await expect(page.getByRole('status')).toContainText(
    'pending Administrator approval',
  );
  await page.goto('/');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Invalid email or password' }),
  ).toContainText('Invalid email or password');
  await login(page);
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
  await openSectionItem(page, 'Administration', 'Users');
  await expect(page.getByRole('note')).toContainText(
    'does not verify email ownership',
  );
  await page
    .getByLabel('Role for approval or invitation')
    .selectOption({ label: 'Management' });
  const row = page
    .locator('section')
    .filter({
      has: page.getByRole('heading', {
        name: 'Access requests and invitations',
        exact: true,
      }),
    })
    .getByRole('row')
    .filter({ hasText: email });
  await row.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: email })
      .filter({ hasText: 'APPROVED' }),
  ).toHaveCount(1);
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  await login(page, email, password);
  await expect(
    page
      .getByRole('navigation', { name: 'Section navigation' })
      .getByRole('button', { name: 'Archive', exact: true }),
  ).toHaveCount(0);
});
test('Administrator invitation is accepted with its bound email and removed from browser history', async ({
  page,
  browser,
}) => {
  await login(page);
  await openSectionItem(page, 'Administration', 'Users');
  const email = `invite-${randomUUID()}@example.invalid`;
  await page
    .getByLabel('Role for approval or invitation')
    .selectOption({ label: 'Management' });
  await page.getByLabel('Invitation email').fill(email);
  await page.getByRole('button', { name: 'Create invitation' }).click();
  const link = await page.getByLabel('Invitation link').inputValue();
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(link);
  await expect.poll(() => new URL(recipient.url()).hash).toBe('');
  await recipient.getByLabel('Full name').fill('Browser invitation');
  await recipient.getByLabel('Email address').fill(email);
  const password = randomUUID() + randomUUID();
  await recipient.getByLabel('Password', { exact: true }).fill(password);
  await recipient
    .getByRole('button', { name: 'Accept invitation', exact: true })
    .click();
  await expect(recipient.getByRole('status')).toContainText('account is ready');
  await login(recipient, email, password);
  await expect(
    recipient
      .getByRole('navigation', { name: 'Section navigation' })
      .getByRole('button', { name: 'Users', exact: true }),
  ).toHaveCount(0);
  await context.close();
});
test('dataset reports stay separate while Archive restores or deletes the campaign safely', async ({
  page,
}) => {
  await login(page);
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const me = await (await page.request.get(`${api}/auth/me`)).json();
  const name = `Archive dataset journey ${randomUUID()}`;
  const created = await mutate(page, '/campaigns', 'POST', {
    name,
    startDate: '2024-01-01',
    responsibleUserId: me.id,
    channels: [],
  });
  expect(created.status()).toBe(201);
  const campaign = await created.json();
  const csrf = await (await page.request.get(`${api}/auth/csrf`)).json();
  const upload = await page.request.post(`${api}/datasets/imports/preview`, {
    headers: {
      Origin: process.env.E2E_BASE_URL!,
      'x-csrf-token': csrf.csrfToken,
    },
    multipart: {
      campaignId: campaign.id,
      file: {
        name: 'archive-data.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('Date,Reach\n2024-01-02,0\n'),
      },
    },
  });
  expect(upload.status()).toBe(201);
  const attempt = await upload.json();
  const imported = await mutate(
    page,
    `/datasets/imports/${attempt.id}/confirm`,
    'POST',
    {},
  );
  expect(imported.status()).toBe(201);
  const dataset = await imported.json();

  await page.goto(`/?campaignId=${campaign.id}#reports`);
  await page
    .getByRole('combobox', { name: 'Campaign', exact: true })
    .selectOption(campaign.id);
  await expect(
    page.getByRole('heading', { name: 'Reports by dataset' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'archive-data' }),
  ).toBeVisible();
  const reportDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export PDF' }).click();
  const report = await reportDownload;
  expect(await report.failure()).toBeNull();
  expect(
    (await readFile((await report.path())!)).subarray(0, 5).toString('ascii'),
  ).toBe('%PDF-');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(
    (await mutate(page, `/campaigns/${campaign.id}`, 'DELETE')).status(),
  ).toBe(200);
  await page.goto('/#archive');
  let row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: 'Restore', exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(
    (await mutate(page, `/campaigns/${campaign.id}`, 'DELETE')).status(),
  ).toBe(200);
  await page.reload();
  await expect(
    page.getByRole('group', { name: 'Archive pages' }),
  ).toBeVisible();
  await page.getByLabel('Search Archive').fill(name);
  row = page.getByRole('row').filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(
    page.getByRole('group', { name: 'Archive pages' }),
  ).toContainText('of');
  await row.getByRole('button', { name: 'Review deletion' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText(/Datasets\s*:\s*1/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await row.getByRole('button', { name: 'Review deletion' }).click();
  await page
    .getByRole('dialog')
    .getByLabel(`Type ${name} to confirm`)
    .fill(name);
  await page
    .getByRole('button', { name: 'Permanently delete', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(row).toHaveCount(0);
  expect(
    (await page.request.get(`${api}/campaigns/${campaign.id}`)).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`${api}/datasets/${dataset.id}`)).status(),
  ).toBe(404);
});
