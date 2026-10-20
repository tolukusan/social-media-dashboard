import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { Client } from 'pg';

// Creates a new loopback-only database. Never resets, drops, or reuses a database.
const url = new URL(process.env.DATABASE_URL!);
assert(
  ['localhost', '127.0.0.1'].includes(url.hostname),
  'Loopback PostgreSQL required',
);
url.searchParams.delete('schema');
url.pathname = '/postgres';
const admin = new Client({ connectionString: url.toString() });
await admin.connect();
try {
  const version = await admin.query('SHOW server_version_num');
  assert(
    Number(version.rows[0].server_version_num) >= 180000 &&
      Number(version.rows[0].server_version_num) < 190000,
    'PostgreSQL 18 required',
  );
  url.pathname = `/smd_test_${randomBytes(6).toString('hex')}`;
  await admin.query(`CREATE DATABASE "${url.pathname.slice(1)}"`);
} finally {
  await admin.end();
}
console.log(
  `Created isolated database ${url.pathname.slice(1)} with no application schema`,
);
const env: NodeJS.ProcessEnv = {
  ...process.env,
  DATABASE_URL: url.toString(),
  NODE_ENV: 'production',
  INTEGRATIONS_SCHEDULER_ENABLED: 'false',
  SEED_ADMIN_EMAIL: 'migration-smoke@example.invalid',
  SEED_ADMIN_PASSWORD: randomBytes(24).toString('hex'),
};
function run(args: string[]) {
  const result = spawnSync(process.execPath, args, { env, encoding: 'utf8' });
  // Do not print command output: it can contain connection details.
  assert.equal(
    result.status,
    0,
    `Command ${args.join(' ')} failed (exit ${result.status})`,
  );
}
const db = new Client({ connectionString: url.toString() });
await db.connect();
try {
  assert.equal(
    (
      await db.query(
        "SELECT 1 FROM pg_namespace WHERE nspname='social_media_dashboard'",
      )
    ).rowCount,
    0,
  );
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  const migrations = await db.query(
    'SELECT count(*)::int AS count FROM social_media_dashboard._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
  );
  console.log(`Applied ${migrations.rows[0].count} migrations`);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations'",
      )
    ).rows[0].count,
    0,
  );
  run(['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts']);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int AS count FROM social_media_dashboard."User"',
      )
    ).rows[0].count,
    1,
  );
  const before = await db.query(
    'SELECT "passwordHash" FROM social_media_dashboard."User"',
  );
  env.SEED_ADMIN_PASSWORD = randomBytes(24).toString('hex');
  run(['node_modules/tsx/dist/cli.mjs', 'prisma/seed.ts']);
  assert.deepEqual(
    (await db.query('SELECT "passwordHash" FROM social_media_dashboard."User"'))
      .rows,
    before.rows,
  );
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  console.log(
    'Production seed and repeated migration/seed passed; existing administrator preserved',
  );
} finally {
  await db.end();
}
const probe = createServer();
await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = (probe.address() as { port: number }).port;
await new Promise<void>((resolve) => probe.close(() => resolve()));
env.PORT = String(port);
const api = spawn(process.execPath, ['--import', 'tsx', 'dist/src/main.js'], {
  env,
  stdio: 'ignore',
});
try {
  let healthy = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      healthy = (
        await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
          signal: AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {
      /* startup */
    }
    if (healthy) break;
    if (api.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(healthy, 'Production API health check failed');
  console.log('Production API startup and health HTTP 200 passed');
} finally {
  api.kill();
}
console.log(
  'Isolated test database retained; no existing database was changed',
);
