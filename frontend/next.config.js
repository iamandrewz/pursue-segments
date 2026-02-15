/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Output standalone for containerized deployment
  output: 'standalone',
  trailingSlash: true,
};

module.exports = nextConfig;
