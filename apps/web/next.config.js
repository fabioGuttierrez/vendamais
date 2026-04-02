/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@vendamais/shared'],
};

module.exports = nextConfig;
