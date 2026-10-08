import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Client } from 'pg';

try {
  const contents = await readFile('.test-database', 'utf8');
  const match = /^DATABASE_URL=(".*")$/m.exec(contents);
  if (!match) throw new Error('Existing test database metadata is invalid.');
  const existing = new URL(JSON.parse(match[1]));
  if (
    !/^\/smd_test_[a-f0-9]{12}$/.test(existing.pathname) ||
    !['localhost', '127.0.0.1', '::1'].includes(existing.hostname)
  )
    throw new Error('Existing test database metadata is invalid.');
  console.log(
    'An isolated local PostgreSQL test database is already configured.',
  );
  process.exit(0);
} catch (error) {
  if (!(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  ))
    throw error;
}

const source = process.env.DATABASE_URL;
if (!source)
  throw new Error(
    'Local DATABASE_URL is required to create a separate test database.',
  );
const base = new URL(source);
if (!['localhost', '127.0.0.1', '::1'].includes(base.hostname))
  throw new Error('Refusing test setup: database host is not loopback.');
if (base.pathname !== '/postgres')
  throw new Error(
    'Refusing test setup: local admin database must be postgres.',
  );

const name = `smd_test_${randomBytes(6).toString('hex')}`;
const adminUrl = new URL(base);
adminUrl.searchParams.delete('schema');
const client = new Client({ connectionString: adminUrl.toString() });
let stage = 'connect';
try {
  await client.connect();
  stage = 'verify local admin target';
  const current = await client.query<{ name: string }>(
    'SELECT current_database() AS name',
  );
  if (current.rows[0]?.name !== 'postgres')
    throw new Error('Unexpected PostgreSQL target.');
  const exists = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [name],
  );
  if (exists.rowCount)
    throw new Error('Generated test database name already exists.');
  stage = 'create dedicated test database';
  await client.query(`CREATE DATABASE "${name}"`);
} catch (error) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : 'unknown';
  throw new Error(
    `Could not ${stage} (database error ${code}); existing databases were not modified.`,
  );
} finally {
  await client.end().catch(() => undefined);
}

const testUrl = new URL(base);
testUrl.pathname = `/${name}`;
testUrl.searchParams.delete('schema');

const schemaClient = new Client({ connectionString: testUrl.toString() });
try {
  await schemaClient.connect();
  await schemaClient.query('CREATE SCHEMA "social_media_dashboard"');
} finally {
  await schemaClient.end().catch(() => undefined);
}

testUrl.searchParams.set('schema', 'social_media_dashboard');
await writeFile(
  '.test-database',
  `DATABASE_URL=${JSON.stringify(testUrl.toString())}\n`,
  { encoding: 'utf8', mode: 0o600, flag: 'wx' },
);
console.log(
  'Created an isolated PostgreSQL test database and application schema. Its URL is stored in ignored apps/api/.test-database; no existing database was reset or modified.',
);
