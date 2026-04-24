/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@prisma/client", "puppeteer", "bullmq", "ioredis"],
  },
};

export default nextConfig;
