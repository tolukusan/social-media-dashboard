import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

try {
  let removed = 0;
  for (let batch = 0; batch < 10; batch += 1) {
    const count = await prisma.$executeRawUnsafe(`
      DELETE FROM "social_media_dashboard"."PasswordRecoveryToken"
      WHERE "id" IN (
        SELECT "id"
        FROM "social_media_dashboard"."PasswordRecoveryToken"
        WHERE "expiresAt" < CURRENT_TIMESTAMP - INTERVAL '30 days'
        ORDER BY "expiresAt"
        LIMIT 500
      )
    `);
    removed += count;
    if (count < 500) break;
  }
  process.stdout.write(
    `Removed ${removed} expired password recovery token records.\n`,
  );
} finally {
  await prisma.$disconnect();
}
