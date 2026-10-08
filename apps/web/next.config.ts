import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.SMD_NEXT_DIST_DIR ?? '.next',
  outputFileTracingRoot: projectRoot,
};
export default nextConfig;
