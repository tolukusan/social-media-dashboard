import 'dotenv/config';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { parse } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createVerificationData,
  cleanupVerificationData,
} from './verification-data.js';

const apiDirectory = process.cwd();
const rootDirectory = path.resolve(apiDirectory, '../..');
const runtimeDirectory = path.join(rootDirectory, 'performance/runtime');
const credentialsPath = path.join(runtimeDirectory, 'load-credentials.json');
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
    'Refusing load test: target is not an isolated local test database.',
  );

const apiPort = 4202;
const apiUrl = `http://localhost:${apiPort}/api/v1`;
const appOrigin = 'http://localhost:3102';
const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  API_PORT: String(apiPort),
  APP_ORIGIN: appOrigin,
  NODE_ENV: 'test',
  SEED_ADMIN_EMAIL: '',
  SEED_ADMIN_PASSWORD: '',
};

function runNode(args: string[]) {
  const result = spawnSync(process.execPath, args, {
    cwd: apiDirectory,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `Load preparation failed with exit code ${result.status ?? 'unknown'}.`,
    );
}

async function assertPortAvailable(port: number) {
  await new Promise<void>((resolve, reject) => {
    const server = createServer();
    server.once('error', () =>
      reject(new Error(`Load-test port ${port} is already in use.`)),
    );
    server.listen(port, '127.0.0.1', () => server.close(() => resolve()));
  });
}

async function waitFor(url: string, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error('The local load-test API exited during startup.');
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry only during bounded local startup.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('The local load-test API did not become ready.');
}

await assertPortAvailable(apiPort);
runNode(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
runNode(['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts']);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const createdIds: string[] = [];
let api: ChildProcess | undefined;
let dataset: Awaited<ReturnType<typeof createVerificationData>> | undefined;
let evidence: Record<string, unknown> | undefined;
try {
  const roles = await prisma.role.findMany({
    where: { code: { in: ['MANAGEMENT', 'MARKETING_OFFICER'] } },
  });
  const password = `Load-${randomUUID()}-Passphrase`;
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const runId = randomUUID();
  const credentials: Array<{
    email: string;
    password: string;
    canWrite: boolean;
    campaignId?: string;
    recordId?: string;
  }> = [];
  for (let index = 0; index < 27; index += 1) {
    const email = `load-${runId}-${index}@example.invalid`;
    const user = await prisma.user.create({
      data: {
        name: `Load Fixture ${index + 1}`,
        email,
        roleId: roles.find(
          (role) =>
            role.code === (index < 5 ? 'MARKETING_OFFICER' : 'MANAGEMENT'),
        )!.id,
        passwordHash,
      },
    });
    createdIds.push(user.id);
    credentials.push({ email, password, canWrite: index < 5 });
  }
  dataset = await createVerificationData(prisma, createdIds[0]);
  credentials.forEach((credential, index) => {
    credential.campaignId =
      dataset!.campaignIds[index % dataset!.campaignCount];
    credential.recordId = dataset!.records[index % dataset!.campaignCount];
  });
  await mkdir(runtimeDirectory, { recursive: true });
  await writeFile(credentialsPath, JSON.stringify(credentials), {
    encoding: 'utf8',
    mode: 0o600,
  });

  api = spawn(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'src/main.ts'],
    {
      cwd: apiDirectory,
      env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  await waitFor(`${apiUrl}/health`, api);

  const results: Record<string, unknown> = {};
  for (const profile of ['warmup', 'mixed', 'pdf-warmup', 'pdf']) {
    const summaryPath = path.join(runtimeDirectory, `load-${profile}.json`);
    const result = spawnSync(
      process.platform === 'win32' ? 'k6.exe' : 'k6',
      [
        'run',
        '--summary-export',
        summaryPath,
        path.join(rootDirectory, 'performance/k6-authenticated.js'),
      ],
      {
        cwd: rootDirectory,
        env: {
          ...env,
          API_URL: apiUrl,
          APP_ORIGIN: appOrigin,
          LOAD_CREDENTIALS: './runtime/load-credentials.json',
          LOAD_PROFILE: profile,
          LOAD_FROM: dataset.from,
          LOAD_TO: dataset.to,
        },
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    if (result.error)
      throw new Error(
        'k6 could not start; install the local verification tool.',
      );
    results[profile] = JSON.parse(await readFile(summaryPath, 'utf8'));
    if (result.status !== 0)
      throw new Error(`Authenticated ${profile} load test failed.`);
  }
  evidence = {
    date: new Date().toISOString(),
    node: process.version,
    dataset: {
      campaigns: dataset.campaignCount,
      records: dataset.recordCount,
      metricValues: dataset.metricValueCount,
    },
    profile: {
      warmup: '5 users / 5s',
      mixed: '25 users / 30s; 5 officers may write every tenth iteration',
      pdf: '2 users / 15s, separate phase',
      pdfWarmup: '2 users / 5s; cold export latency retained separately',
    },
    workload:
      'One view per action; 1.5s think time; assumed 40/20/20/20 dashboard/trends/campaigns/performance mix',
    thresholds:
      'Local evaluation targets: failed requests <1%, checks >99%, measured mixed/PDF p95 <1000ms; warm-up is excluded from latency acceptance; abort on failure/check thresholds after 5s',
    results,
  };
} finally {
  api?.kill();
  if (dataset) await cleanupVerificationData(prisma, dataset.campaignIds);
  if (createdIds.length) {
    await prisma.auditLog.deleteMany({
      where: { actorUserId: { in: createdIds } },
    });
    await prisma.session.deleteMany({ where: { userId: { in: createdIds } } });
    await prisma.passwordRecoveryToken.deleteMany({
      where: { userId: { in: createdIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdIds } } });
  }
  await prisma.$disconnect();
  await unlink(credentialsPath).catch(() => undefined);
}

if (evidence)
  await writeFile(
    path.join(runtimeDirectory, 'load-evidence.json'),
    JSON.stringify(
      {
        ...evidence,
        cleanup: 'Fixture data and credentials removed; temporary API stopped.',
      },
      null,
      2,
    ),
  );

console.log(
  'Authenticated mixed 25-user and separate PDF load baselines completed; isolated fixtures removed.',
);
