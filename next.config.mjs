/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker/Railway deployment
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
