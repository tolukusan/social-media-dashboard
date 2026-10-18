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
  await expect(page.locator('h1')).toHaveText('Campaign overview');
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
      .getByRole('navigation', { name: 'Primary navigation' })
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
      .getByRole('navigation', { name: 'Primary navigation' })
      .getByRole('button', { name: 'Users', exact: true }),
  ).toHaveCount(0);
  await context.close();
});
test('campaign defaults, report scope and Archive restore/delete work on desktop and mobile', async ({
  page,
}) => {
  await login(page);
  const api = process.env.NEXT_PUBLIC_API_URL!;
  const period = await (
    await page.request.get(`${api}/analytics/default-period`)
  ).json();
  await expect(page.getByLabel('From', { exact: true })).toHaveValue(
    period.from,
  );
  await expect(page.getByLabel('To', { exact: true })).toHaveValue(period.to);
  await page.goto('/?from=2024-01-02#overview');
  await expect(page.getByLabel('From', { exact: true })).toHaveValue(
    '2024-01-02',
  );
  await expect(page.getByLabel('To', { exact: true })).toHaveValue('');
  const me = await (await page.request.get(`${api}/auth/me`)).json();
  const channels = await (await page.request.get(`${api}/channels`)).json();
  const channel = channels.find((c: { code: string }) => c.code === 'SOCIAL');
  const platform = channel.platforms.find((p: { active: boolean }) => p.active);
  const name = `Archive journey ${randomUUID()}`;
  const created = await mutate(page, '/campaigns', 'POST', {
    name,
    startDate: '2024-01-01',
    responsibleUserId: me.id,
    channels: [{ channelId: channel.id, platformIds: [platform.id] }],
  });
  expect(created.status()).toBe(201);
  const campaign = await created.json();
  const context = campaign.campaignChannels[0].campaignPlatforms[0];
  const record = await mutate(page, '/performance-records', 'POST', {
    campaignPlatformId: context.id,
    recordDate: '2024-01-02',
    values: {
      SM_ENGAGEMENTS: 0,
      SM_REACH: 1,
      SM_IMPRESSIONS: 2,
      SM_LINK_CLICKS: 3,
      SM_FOLLOWERS_GAINED: 4,
    },
  });
  expect(record.status()).toBe(201);
  await page.goto(
    `/?from=2024-01-01&to=2024-01-30&campaignId=${campaign.id}#overview`,
  );
  const socialHeadlines = page.getByRole('region', {
    name: 'Social Media Marketing headline metrics',
  });
  await expect(socialHeadlines.locator('.kpi')).toHaveCount(4);
  await expect(socialHeadlines.locator('.kpi span')).toHaveText([
    'Engagements',
    'Aggregated daily reach',
    'Impressions',
    'Link Clicks',
  ]);
  await expect(page.getByLabel('Trend metric')).toBeVisible();
  const emailChannel = channels.find(
    (item: { code: string }) => item.code === 'EMAIL',
  );
  const emailPlatform = emailChannel.platforms.find(
    (item: { active: boolean }) => item.active,
  );
  const emailCampaignResponse = await mutate(page, '/campaigns', 'POST', {
    name: `Email headline journey ${randomUUID()}`,
    startDate: '2024-01-01',
    responsibleUserId: me.id,
    channels: [{ channelId: emailChannel.id, platformIds: [emailPlatform.id] }],
  });
  expect(emailCampaignResponse.status()).toBe(201);
  const emailCampaign = await emailCampaignResponse.json();
  const emailContext = emailCampaign.campaignChannels[0].campaignPlatforms[0];
  const emailRecord = await mutate(page, '/performance-records', 'POST', {
    campaignPlatformId: emailContext.id,
    recordDate: '2024-01-02',
    values: {
      EMAIL_OPENS: 0,
      EMAIL_SENT: 2,
      EMAIL_DELIVERED: 1,
      EMAIL_CLICKS: 3,
      EMAIL_UNSUBSCRIBES: 4,
    },
  });
  expect(emailRecord.status()).toBe(201);
  await page.goto(
    `/?from=2024-01-01&to=2024-01-30&channelId=${emailChannel.id}#overview`,
  );
  const emailHeadlines = page.getByRole('region', {
    name: `${emailChannel.name} headline metrics`,
  });
  await expect(emailHeadlines.locator('.kpi')).toHaveCount(4);
  await expect(emailHeadlines.locator('.kpi span')).toHaveText([
    'Opens',
    'Emails Sent',
    'Emails Delivered',
    'Email Clicks',
  ]);
  await page.goto(
    `/?from=2024-01-01&to=2024-01-30&campaignId=${campaign.id}#reports`,
  );
  await expect(page.getByLabel('Campaign', { exact: true })).toHaveValue(
    campaign.id,
  );
  await expect(
    page.getByRole('rowheader', { name: 'Engagements', exact: true }),
  ).toBeVisible();
  const preview = await (
    await page.request.get(
      `${api}/reports/preview?campaignId=${campaign.id}&from=2024-01-01&to=2024-01-30`,
    )
  ).json();
  expect(
    preview.summary.kpis.every(
      (k: { value: number | null }) => k.value !== null,
    ),
  ).toBe(true);
  expect(
    preview.summary.kpis.some((k: { value: number | null }) => k.value === 0),
  ).toBe(true);
  await page.getByLabel('Include unavailable metrics').check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toContain(
    '2024-01-01_to_2024-01-30',
  );
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await row.getByRole('button', { name: 'Review deletion' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
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
});
