import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'export',
  devIndicators: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  images: { unoptimized: true },
  poweredByHeader: false,
  trailingSlash: true,
};
export default config;
