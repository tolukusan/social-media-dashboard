import 'dotenv/config';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';

const apiDirectory = process.cwd();
const rootDirectory = path.resolve(apiDirectory, '../..');
const webDirectory = path.join(rootDirectory, 'apps/web');
const stored = parse(
  await readFile('.test-database').catch(() => {
    throw new Error('Run pnpm test:db:prepare first.');
  }),
);
const databaseUrl = stored.DATABASE_URL;
if (!databaseUrl) throw new Error('Test database configuration is incomplete.');
const database = new URL(databaseUrl);
if (
  !/^\/smd_test_[a-f0-9]{12}$/.test(database.pathname) ||
  !['localhost', '127.0.0.1', '::1'].includes(database.hostname)
)
  throw new Error(
    'Refusing E2E: the configured target is not an isolated local test database.',
  );

const apiPort = 4201;
const webPort = 3101;
const apiUrl = `http://localhost:${apiPort}/api/v1`;
const webUrl = `http://localhost:${webPort}`;

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(
        new Error(`E2E port ${port} is already in use; no server was started.`),
      ),
    );
    server.listen(port, '127.0.0.1', () => server.close(() => resolve()));
  });
}

function runNode(args: string[], cwd: string, env: NodeJS.ProcessEnv) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `E2E preparation command failed with exit code ${result.status ?? 'unknown'}.`,
    );
}

async function waitFor(url: string, children: ChildProcess[]) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (children.some((child) => child.exitCode !== null))
      throw new Error('A local E2E server exited during startup.');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // A short startup retry is expected while the local process binds its port.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('A local E2E server did not become ready within 30 seconds.');
}

await assertPortAvailable(apiPort);
await assertPortAvailable(webPort);

const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  API_PORT: String(apiPort),
  APP_ORIGIN: webUrl,
  NEXT_PUBLIC_API_URL: apiUrl,
  E2E_BASE_URL: webUrl,
};
const webEnv: NodeJS.ProcessEnv = {
  ...env,
  NODE_ENV: 'production',
  SMD_NEXT_DIST_DIR: '.next-e2e',
};
const apiEnv: NodeJS.ProcessEnv = { ...env, NODE_ENV: 'development' };

runNode(
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  apiDirectory,
  env,
);
runNode(['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts'], apiDirectory, env);
runNode(
  ['node_modules/tsx/dist/cli.mjs', 'scripts/prepare-e2e-users.ts'],
  apiDirectory,
  env,
);
const credentials = JSON.parse(
  await readFile('.e2e-credentials', 'utf8'),
) as Record<string, { email: string; password: string }>;
const admin = credentials.administrator;
if (!admin)
  throw new Error('The isolated Administrator E2E account is missing.');
env.E2E_EMAIL = admin.email;
env.E2E_PASSWORD = admin.password;
runNode(['node_modules/next/dist/bin/next', 'build'], webDirectory, webEnv);

const children: ChildProcess[] = [];
try {
  children.push(
    spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/main.ts'], {
      cwd: apiDirectory,
      env: apiEnv,
      stdio: 'inherit',
      windowsHide: true,
    }),
  );
  children.push(
    spawn(
      process.execPath,
      ['node_modules/next/dist/bin/next', 'start', '-p', String(webPort)],
      { cwd: webDirectory, env: webEnv, stdio: 'inherit', windowsHide: true },
    ),
  );
  await Promise.all([
    waitFor(`${apiUrl}/health`, children),
    waitFor(webUrl, children),
  ]);
  runNode(
    [path.join(rootDirectory, 'node_modules/@playwright/test/cli.js'), 'test'],
    rootDirectory,
    env,
  );
} finally {
  for (const child of children) child.kill();
}

console.log(
  'Isolated local API/web E2E smoke completed; temporary servers stopped.',
);
