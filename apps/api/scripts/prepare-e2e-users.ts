import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error('TEST_DATABASE_URL is required for E2E fixture setup.');
const target = new URL(databaseUrl);
if (
  !/^\/smd_test_[a-f0-9]{12}$/.test(target.pathname) ||
  !['localhost', '127.0.0.1', '::1'].includes(target.hostname)
)
  throw new Error(
    'Refusing E2E fixture setup outside the isolated test database.',
  );

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});
const fixtures = [
  { code: 'ADMIN', key: 'administrator', name: 'E2E Administrator' },
  {
    code: 'MARKETING_OFFICER',
    key: 'marketingOfficer',
    name: 'E2E Marketing Officer',
  },
  { code: 'MANAGEMENT', key: 'management', name: 'E2E Management' },
] as const;
const credentials: Record<string, { email: string; password: string }> = {};

try {
  for (const fixture of fixtures) {
    const role = await prisma.role.findUniqueOrThrow({
      where: { code: fixture.code },
    });
    const email = `e2e.${fixture.key}@example.test`.toLowerCase();
    const password = randomBytes(32).toString('base64url');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
    });
    await prisma.user.upsert({
      where: { email },
      update: {
        roleId: role.id,
        name: fixture.name,
        passwordHash,
        active: true,
      },
      create: { email, roleId: role.id, name: fixture.name, passwordHash },
    });
    credentials[fixture.key] = { email, password };
  }
  await writeFile(
    '.e2e-credentials',
    `${JSON.stringify(credentials, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  console.log(
    'Prepared isolated accounts for all three fixed roles; generated credentials were stored in an ignored local file.',
  );
} finally {
  await prisma.$disconnect();
}
