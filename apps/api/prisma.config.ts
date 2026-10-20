import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';
import { applicationDatabaseUrl } from './src/database/database-url.js';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: applicationDatabaseUrl(env('DATABASE_URL')) },
});
