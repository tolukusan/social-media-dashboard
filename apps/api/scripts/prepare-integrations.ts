import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// Local-only, additive preparation. Never resets data or updates existing catalogue entries.
const value = process.env.DATABASE_URL;
if (!value)
  throw new Error('Local application database configuration is required.');
const target = new URL(value);
if (
  !['localhost', '127.0.0.1', '::1'].includes(target.hostname) ||
  target.searchParams.get('schema') !== 'social_media_dashboard'
)
  throw new Error(
    'Refusing local integration setup outside the explicitly configured local application schema.',
  );

const result = spawnSync(
  process.execPath,
  ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
  { stdio: 'inherit', windowsHide: true, shell: false },
);
if (result.error || result.status !== 0)
  throw new Error(
    'Local additive migration preparation failed; database details omitted.',
  );
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: value }),
});
try {
  for (const [channelCode, code, name] of [
    ['ADVERTISING', 'FACEBOOK_ADS', 'Facebook Ads'],
    ['ADVERTISING', 'INSTAGRAM_ADS', 'Instagram Ads'],
    ['ADVERTISING', 'LINKEDIN_ADS', 'LinkedIn Ads'],
    ['EMAIL', 'ZOHO_CAMPAIGNS', 'Zoho Campaigns'],
  ]) {
    const channel = await prisma.marketingChannel.findUnique({
      where: { code: channelCode },
    });
    if (!channel)
      throw new Error(
        'Prepare the existing application channel catalogue first.',
      );
    await prisma.platform.upsert({
      where: { channelId_code: { channelId: channel.id, code } },
      create: { channelId: channel.id, code, name },
      update: {},
    });
  }
  console.log(
    'Local integration migration and missing provider catalogue entries prepared. Existing data and catalogue settings retained.',
  );
} catch {
  throw new Error(
    'Local provider catalogue preparation failed; database details omitted.',
  );
} finally {
  await prisma.$disconnect();
}
