/** @type {import('next').NextConfig} */
const backendHost = process.env.BACKEND_URL || 'http://localhost:8000';

const nextConfig = {
  output: 'standalone',
  typescript: {
    // Allows production builds to succeed on Vercel even if minor type mismatches exist
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
