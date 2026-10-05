/** @type {import('next').NextConfig} */
const backendHost = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  output: 'standalone',
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${backendHost}/api/:path*` },
      { source: '/health/:path*', destination: `${backendHost}/health/:path*` },
    ];
  },
};

module.exports = nextConfig;
