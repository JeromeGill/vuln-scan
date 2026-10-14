import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { env as sharedEnv } from "./shared.js";

/**
 * Server-side only (shared.ts reads .env files with node:fs): use it from
 * next.config.ts or server code, never from client components.
 */
export const env = createEnv({
  extends: [sharedEnv],
  server: {
    /** Where /api/auth is proxied to. */
    API_URL: z.url().default("http://localhost:3002"),
    /**
     * Next.js's build directory. The browser tests use their own, so their
     * `next dev` can run next to the one `script/server` starts.
     */
    NEXT_DIST_DIR: z.string().default(".next"),
    /**
     * Shows "Continue with Google" on the login and sign-up pages.
     * Turn it on only where the api has `GOOGLE_CLIENT_ID` and
     * `GOOGLE_CLIENT_SECRET`.
     */
    GOOGLE_SIGN_IN: z.stringbool().default(false),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
