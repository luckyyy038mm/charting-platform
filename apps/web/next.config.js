/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@charting-platform/shared-schema',
    '@charting-platform/market-types',
    '@charting-platform/chart-engine',
    '@charting-platform/chart-ui',
  ],
  webpack: (config) => {
    // Enable WebGL support
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
    };
    return config;
  },
};

module.exports = nextConfig;
