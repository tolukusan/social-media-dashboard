import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // These smoke journeys share one organisation and fixed-role fixtures.
  // Concurrent load is exercised by the separate isolated load harness.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
});
