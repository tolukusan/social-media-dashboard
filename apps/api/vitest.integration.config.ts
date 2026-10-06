import { defineConfig } from 'vitest/config';

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'Set TEST_DATABASE_URL to a dedicated isolated test database before running integration tests.',
  );
}
const integrationDatabase = new URL(process.env.TEST_DATABASE_URL);
if (
  !/^\/smd_test_[a-f0-9]{12}$/.test(integrationDatabase.pathname) ||
  !['localhost', '127.0.0.1', '::1'].includes(integrationDatabase.hostname)
) {
  throw new Error(
    'Refusing integration tests: TEST_DATABASE_URL must point to an isolated local test database.',
  );
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
