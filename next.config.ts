import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output is for self-hosting/local preview only.
  // On Vercel, its default output pipeline is used instead.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
