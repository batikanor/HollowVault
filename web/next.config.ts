import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // @hollow-vault/core ships TS source (no build step). Next must transpile it.
  transpilePackages: ["@hollow-vault/core"],
  // The Bloomberg/HVLT terminal lives in web/public/index.html; map "/" to it
  // so it becomes the canonical home. The other Next routes (/typed, /batch,
  // /verify, /vulnerability) keep working as alternative views.
  async rewrites() {
    return [{ source: "/", destination: "/index.html" }];
  },
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
