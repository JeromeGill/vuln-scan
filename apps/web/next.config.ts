import { randomUUID } from "node:crypto";
import { env } from "@repo/config/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: env.NEXT_DIST_DIR,
  // A new version per build, inlined into the client (lib/build.ts): the
  // worker is registered as /sw.js?v=<version>, so each build installs a new
  // worker, which drops the previous build's caches.
  env: { SW_VERSION: randomUUID() },
  async rewrites() {
    // Rewrites are tried in order, so the auth rule must come first.
    return [
      // Proxy Better Auth so its session cookie is set on the web origin.
      {
        source: "/api/auth/:path*",
        destination: `${env.API_URL}/api/auth/:path*`,
      },
      // Everything else under /api is an oRPC route served at the api root
      // (/api/account → /account), so the browser stays same-origin and sends the
      // session cookie.
      {
        source: "/api/:path*",
        destination: `${env.API_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
