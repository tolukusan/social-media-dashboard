import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parse } from 'dotenv';

const config = parse(
  await readFile('.test-database').catch(() => {
    throw new Error('Run pnpm test:db:prepare first.');
  }),
);
const value = config.DATABASE_URL;
if (!value) throw new Error('Test database configuration is incomplete.');
const target = new URL(value);
if (
  !/^\/smd_test_[a-f0-9]{12}$/.test(target.pathname) ||
  !['localhost', '127.0.0.1', '::1'].includes(target.hostname)
)
  throw new Error(
    'Refusing integration tests: target is not an isolated local test database.',
  );
const source = process.env.DATABASE_URL;
if (source && new URL(source).toString() === target.toString())
  throw new Error(
    'Refusing integration tests: test and configured development targets are identical.',
  );
process.env.TEST_DATABASE_URL = value;
process.env.DATABASE_URL = value;

async function run(args: string[]) {
  const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    stdio: 'inherit',
    shell: false,
  });
  const status: number | null = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (status !== 0)
    throw new Error(
      `Integration step failed with exit code ${status ?? 'unknown'}; target details omitted.`,
    );
}

await run(['exec', 'prisma', 'migrate', 'deploy']);
await run(['exec', 'tsx', 'prisma/seed.ts']);
await run([
  'exec',
  'vitest',
  'run',
  '--config',
  'vitest.integration.config.ts',
]);
