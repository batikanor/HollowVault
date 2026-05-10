import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // @hollow-vault/core ships TS source (no build step). Next must transpile it.
  transpilePackages: ["@hollow-vault/core"],
  webpack(config) {
    // Core uses ESM-style ".js" suffixes that resolve to ".ts" sources at build.
    config.resolve.extensionAlias = {
      ...(config.resolve.extensionAlias ?? {}),
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
