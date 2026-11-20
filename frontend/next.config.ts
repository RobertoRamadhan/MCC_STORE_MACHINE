import path from 'node:path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    "169.254.57.26",
    "169.254.144.116",
    "localhost",
    "127.0.0.1",
    "mcc.local",
  ],
  turbopack: {
    root: path.resolve(__dirname, '..'),
  },
  async rewrites() {
    const apiBackendUrl = (process.env.API_BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

    return {
      beforeFiles: [
        {
          source: '/api/:path*',
          destination: `${apiBackendUrl}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;