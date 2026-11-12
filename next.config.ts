import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "169.254.57.26",
    "169.254.144.116",
    "localhost",
    "127.0.0.1",
    "mcc.local",
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;