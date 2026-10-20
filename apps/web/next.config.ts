import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveProductionApiOrigin } from './lib/deployment-config.cjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const productionApiOrigin = resolveProductionApiOrigin(
  process.env.NODE_ENV,
  process.env.SMD_API_ORIGIN,
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.SMD_NEXT_DIST_DIR ?? '.next',
  outputFileTracingRoot: projectRoot,
  async rewrites() {
    if (!productionApiOrigin) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${productionApiOrigin}/api/v1/:path*`,
      },
    ];
  },
};
export default nextConfig;
