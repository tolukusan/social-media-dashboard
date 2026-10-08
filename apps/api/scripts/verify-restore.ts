import 'dotenv/config';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile, writeFile, mkdir, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'dotenv';
import { Client } from 'pg';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  createVerificationData,
  cleanupVerificationData,
} from './verification-data.js';

const stored = parse(await readFile('.test-database'));
const source = new URL(stored.DATABASE_URL);
if (
  !/^\/smd_test_[a-f0-9]{12}$/.test(source.pathname) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)
)
  throw new Error(
    'Restore verification requires an isolated local test source.',
  );
if (
  process.env.DATABASE_URL &&
  new URL(process.env.DATABASE_URL).pathname === source.pathname
)
  throw new Error(
    'Restore verification cannot use the configured development database.',
  );
source.searchParams.delete('schema');
const restoreName = `smd_restore_${randomBytes(6).toString('hex')}`;
const restored = new URL(source);
restored.pathname = `/${restoreName}`;
const administrative = new URL(source);
administrative.pathname = '/postgres';
const runtime = path.resolve(process.cwd(), '../../performance/runtime');
const backupPath = path.join(runtime, `${restoreName}.dump`);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: source.toString() }),
});
const admin = new Client({ connectionString: administrative.toString() });
const original = new Client({ connectionString: source.toString() });
let restoreClient: Client | undefined;
let api: ChildProcess | undefined;
let created = false;
let userId: string | undefined;
let dataset: Awaited<ReturnType<typeof createVerificationData>> | undefined;
let evidence: Record<string, unknown> | undefined;

function postgresTool(name: string, args: string[], target: URL) {
  const result = spawnSync(
    process.platform === 'win32' ? `${name}.exe` : name,
    args,
    {
      env: {
        ...process.env,
        PGHOST: target.hostname,
        PGPORT: target.port || '5432',
        PGUSER: decodeURIComponent(target.username),
        PGPASSWORD: decodeURIComponent(target.password),
        PGDATABASE: target.pathname.slice(1),
      },
      stdio: 'pipe',
      windowsHide: true,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`${name} failed; connection details omitted.`);
}

async function fingerprints(client: Client) {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'social_media_dashboard'
     AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY table_name`,
  );
  const values: Record<string, { count: number; digest: string }> = {};
  for (const { table_name: table } of rows) {
    if (!/^[A-Za-z_]+$/.test(table))
      throw new Error('Unexpected application table.');
    const result = await client.query<{ count: string; digest: string }>(
      `SELECT count(*) AS count, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY id)::text, '[]')) AS digest
       FROM "social_media_dashboard"."${table}" t`,
    );
    values[table] = {
      count: Number(result.rows[0].count),
      digest: result.rows[0].digest,
    };
  }
  return values;
}

async function waitFor(url: string, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error('Restored API exited during startup.');
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* Bounded startup retry. */
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('Restored API startup timed out.');
}

try {
  await admin.connect();
  await original.connect();
  const version = (
    await original.query<{ server_version_num: string }>(
      'SHOW server_version_num',
    )
  ).rows[0];
  const postgresVersion = Number(version.server_version_num);
  if (postgresVersion < 180000 || postgresVersion >= 190000)
    throw new Error('Acceptance restore verification requires PostgreSQL 18.');
  const port = 4203;
  await new Promise<void>((resolve, reject) => {
    const socket = createServer();
    socket.once('error', () =>
      reject(new Error('Restore verification port is already in use.')),
    );
    socket.listen(port, '127.0.0.1', () => socket.close(() => resolve()));
  });
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: 'MANAGEMENT' },
  });
  const password = randomUUID() + randomUUID();
  const email = `restore-${randomUUID()}@example.invalid`;
  const user = await prisma.user.create({
    data: {
      name: 'Restore verification fixture',
      email,
      roleId: role.id,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    },
  });
  userId = user.id;
  dataset = await createVerificationData(prisma, user.id, 2);
  const before = await fingerprints(original);
  await mkdir(runtime, { recursive: true });
  postgresTool('pg_dump', ['--format=custom', `--file=${backupPath}`], source);
  const backupBytes = (await stat(backupPath)).size;
  const backupSha256 = createHash('sha256')
    .update(await readFile(backupPath))
    .digest('hex');
  if (
    !/^smd_restore_[a-f0-9]{12}$/.test(restoreName) ||
    restored.pathname === source.pathname
  )
    throw new Error('Unsafe restore destination.');
  // A unique database is created by this run; no pre-existing target is dropped.
  await admin.query(`CREATE DATABASE "${restoreName}"`);
  created = true;
  postgresTool(
    'pg_restore',
    ['--exit-on-error', '--no-owner', '--dbname', restoreName, backupPath],
    restored,
  );
  restoreClient = new Client({ connectionString: restored.toString() });
  await restoreClient.connect();
  const after = await fingerprints(restoreClient);
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Restored application data differs from source.');
  const appOrigin = 'http://localhost:3103';
  const apiUrl = `http://127.0.0.1:${port}/api/v1`;
  const databaseUrl = new URL(restored);
  databaseUrl.searchParams.set('schema', 'social_media_dashboard');
  api = spawn(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'src/main.ts'],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl.toString(),
        API_PORT: String(port),
        APP_ORIGIN: appOrigin,
        NODE_ENV: 'test',
      },
      stdio: 'ignore',
      windowsHide: true,
    },
  );
  await waitFor(`${apiUrl}/health`, api);
  const login = await fetch(`${apiUrl}/auth/login`, {
    method: 'POST',
    headers: { Origin: appOrigin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookie = login.headers
    .get('set-cookie')
    ?.match(/smd_session=[^;]+/)?.[0];
  if (login.status !== 201 || !cookie)
    throw new Error('Restored account did not authenticate.');
  const campaigns = await fetch(`${apiUrl}/campaigns`, {
    headers: { Cookie: cookie },
  });
  const items = (await campaigns.json()) as Array<{ id: string }>;
  if (
    !campaigns.ok ||
    !dataset.campaignIds.every((id) => items.some((item) => item.id === id))
  )
    throw new Error('Restored authenticated campaign read failed.');
  const analytics = await fetch(
    `${apiUrl}/analytics/dashboard?from=${dataset.from}&to=${dataset.to}&campaignId=${dataset.campaignIds[0]}`,
    { headers: { Cookie: cookie } },
  );
  const summary = (await analytics.json()) as { recordCount: number };
  if (!analytics.ok || summary.recordCount !== 30)
    throw new Error(
      'Restored analytics read did not retain the fixture records.',
    );
  evidence = {
    date: new Date().toISOString(),
    postgresVersion,
    node: process.version,
    restoredDatabase: restoreName,
    backupBytes,
    backupSha256,
    tables: Object.fromEntries(
      Object.entries(before).map(([table, value]) => [
        table,
        {
          sourceCount: value.count,
          restoredCount: after[table].count,
          dataMatch: true,
        },
      ]),
    ),
    fixture: { campaigns: 2, records: 60, metricValues: 120 },
    health: 'passed',
    authentication: 'passed',
    campaignRead: 'passed',
    analyticsRead: 'passed',
    migrationOrSeedOnRestore: false,
  };
} finally {
  if (api && api.exitCode === null) {
    const stopped = new Promise<void>((resolve) =>
      api!.once('exit', () => resolve()),
    );
    api.kill();
    await stopped;
  }
  await restoreClient?.end();
  if (created) {
    if (
      !/^smd_restore_[a-f0-9]{12}$/.test(restoreName) ||
      restored.pathname === source.pathname
    )
      throw new Error('Refusing unsafe restore cleanup.');
    await admin.query(`DROP DATABASE "${restoreName}"`);
  }
  if (dataset) await cleanupVerificationData(prisma, dataset.campaignIds);
  if (userId) {
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
  await original.end();
  await admin.end();
  await unlink(backupPath).catch(() => undefined);
}
if (evidence)
  await writeFile(
    path.join(runtime, 'restore-evidence.json'),
    JSON.stringify(
      {
        ...evidence,
        cleanup:
          'Temporary API, restore database, backup and source fixtures removed.',
      },
      null,
      2,
    ),
  );
console.log(
  'PostgreSQL 18 isolated restore, data fingerprints, health, authentication and analytics reads passed; temporary artifacts removed.',
);
