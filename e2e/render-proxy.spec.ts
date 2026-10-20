import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('same-origin API proxy preserves CSRF, login session, logout, and OAuth callback routing', async ({
  page,
}) => {
  const frontendOrigin = new URL(process.env.E2E_BASE_URL!).origin;
  const api = process.env.E2E_API_URL!;
  expect(new URL(api).origin).toBe(frontendOrigin);

  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/v1/'))
      apiRequests.push(request.url());
  });

  const credentials = JSON.parse(
    await readFile('apps/api/.e2e-credentials', 'utf8'),
  ) as Record<string, { email: string; password: string }>;
  const administrator = credentials.administrator;
  if (!administrator)
    throw new Error('The isolated Administrator E2E account is missing.');

  await page.goto('/');
  const csrfToken = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/csrf', {
      credentials: 'include',
    });
    if (!response.ok) throw new Error('The CSRF endpoint was not proxied.');
    return ((await response.json()) as { csrfToken: string }).csrfToken;
  });
  const csrfCookie = (await page.context().cookies([frontendOrigin])).find(
    (cookie) => cookie.name === 'csrf_token',
  );
  expect(csrfCookie).toMatchObject({ httpOnly: false, sameSite: 'Lax' });

  const login = await page.evaluate(
    async ({ email, password, token }) => {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ email, password }),
      });
      return { status: response.status, body: await response.json() };
    },
    {
      email: administrator.email,
      password: administrator.password,
      token: csrfToken,
    },
  );
  expect(login.status).toBe(201);

  const rejectedWrite = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'wrong',
      },
      body: JSON.stringify({ name: 'This change must be rejected' }),
    });
    return response.status;
  });
  expect(rejectedWrite).toBe(403);

  const sessionCookie = (await page.context().cookies([frontendOrigin])).find(
    (cookie) => cookie.name === 'smd_session',
  );
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax' });
  await page.reload();
  await expect(page.locator('h1')).toHaveText('Overview');

  const identity = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/me', { credentials: 'include' });
    return { status: response.status, body: await response.json() };
  });
  expect(identity.status).toBe(200);
  expect(identity.body.email).toBe(administrator.email);

  const logout = await page.evaluate(async (token) => {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': token },
    });
    return response.status;
  }, csrfToken);
  expect(logout).toBe(201);

  const unauthenticated = await page.evaluate(
    async () =>
      (
        await fetch('/api/v1/auth/me', {
          credentials: 'include',
          redirect: 'manual',
        })
      ).status,
  );
  expect(unauthenticated).toBe(401);

  const callback = await page.request.get(
    `${api}/integrations/oauth/meta/callback?state=unmatched&error=access_denied`,
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(303);
  expect(callback.headers().location).toBe(
    `${frontendOrigin}/integrations?oauth=error`,
  );

  expect(apiRequests.length).toBeGreaterThan(0);
  expect(
    apiRequests.every((url) => new URL(url).origin === frontendOrigin),
  ).toBe(true);
});
