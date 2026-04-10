/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output for Docker/Railway deployment
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },

  // Redirect /dashboard/* → /* so Clerk's configured afterSignInUrl
  // (/dashboard/onboarding, /dashboard, etc.) always resolves correctly.
  // The (dashboard) route group does NOT add a /dashboard URL prefix.
  async redirects() {
    return [
      {
        source: "/dashboard/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
