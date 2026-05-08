import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // No NEXT_PUBLIC_DEMO_MODE — the mode pill reads live from /health.
};

export default nextConfig;
