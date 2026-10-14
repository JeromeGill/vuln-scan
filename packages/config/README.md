# @repo/config

Validated environment configuration for the apps: zod schemas, checked when
first imported, so a missing or invalid value stops startup.

- **Entry points:** `@repo/config/shared`, `/api`, `/web`, `/worker`, `/e2e`
  (the browser tests). An app imports only its own (web's is for `next.config.ts` and server code only).
- **Used by:** the apps. Packages don't import it; they take settings as
  arguments.
- **Depends on:** zod and `@t3-oss/env-core` only. No app code, no I/O
  beyond reading the repo-root `.env` files.
