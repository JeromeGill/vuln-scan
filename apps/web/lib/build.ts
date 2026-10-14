/**
 * Build-time constants that Next.js inlines into client code. They're not
 * runtime configuration (that's `@repo/config`), so this is the one place the
 * web app reads `process.env` directly.
 */
const serviceWorkerVersion = process.env.SW_VERSION;
if (!serviceWorkerVersion) {
  throw new Error("SW_VERSION is missing; next.config.ts sets it.");
}

export const build = {
  /** `NODE_ENV`: the service worker only runs in production builds. */
  isProduction: process.env.NODE_ENV === "production",
  /** From next.config.ts `env`: a new value per build. */
  serviceWorkerVersion,
};
