# Configuration

All configuration comes from environment variables, declared and validated in
`@repo/config` (`packages/config/src/`). **Don't read `process.env` anywhere
else**: import `env` from the config entry point instead.

| Entry point           | File        | Used by                                        |
| --------------------- | ----------- | ---------------------------------------------- |
| `@repo/config/shared` | `shared.ts` | the other two (loads `.env` files, `NODE_ENV`) |
| `@repo/config/api`    | `api.ts`    | `apps/api`, api tests                          |
| `@repo/config/web`    | `web.ts`    | `apps/web/next.config.ts` and server code only |
| `@repo/config/worker` | `worker.ts` | `apps/worker`, worker tests                    |
| `@repo/config/e2e`    | `e2e.ts`    | `apps/e2e` (the browser tests)                 |

`database.ts` holds what the api and worker schemas share (the `DB_*`
variables); it isn't an entry point.

Validation (zod via `@t3-oss/env-core`) runs at import time, so a missing or
invalid value stops the app at startup with a clear message. Empty strings
count as unset.

## Where values come from

`shared.ts` loads the **repo-root** env files into `process.env` the first
time any config entry point is imported. It finds the root by walking up from
the working directory to the folder containing `pnpm-workspace.yaml` (not
from its own file location, which isn't meaningful once Next.js bundles it
into server code). It loads:

- normally: `.env`
- when `NODE_ENV=test`: `.env.test`, then `.env`

A variable that's already set is never overwritten, so precedence is:

```
shell / CI environment  >  .env.test (tests only)  >  .env  >  schema default
```

`.env` and `.env.test` are gitignored. Their templates, `.env.example` and
`.env.test.example`, are committed; `script/bootstrap` creates the real files
from them. `.env.test` holds only test overrides (currently `DB_NAME`,
`RABBITMQ_URL` with a `_test` vhost, short `JOB_RETRY_DELAYS_MS`, and the
`vulnscan-test` `GCS_BUCKET`).

docker compose also reads the `DB_*` values from `.env` to create the
Postgres user and database.

Deployed services have no `.env` files: on Railway, every value is a service
variable (see [Deployment](deployment.md#variables)). In CI, the release
workflow creates `.env` and `.env.test` from the `.example` files.

## Variables

| Variable               | Schema      | Default                                   | Notes                                                                   |
| ---------------------- | ----------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `NODE_ENV`             | shared      | `development`                             | `development`, `test`, or `production`. Vitest sets `test`.             |
| `PORT`                 | api         | `3002`                                    | api listen port                                                         |
| `DB_HOST`              | api, worker | `localhost`                               |                                                                         |
| `DB_PORT`              | api, worker | `5432`                                    | also the host port docker compose publishes                             |
| `DB_USER`              | api, worker | — (required)                              |                                                                         |
| `DB_PASSWORD`          | api, worker | — (required)                              |                                                                         |
| `DB_NAME`              | api, worker | — (required)                              | `vulnscan`; `vulnscan_test` in `.env.test` (must end `_test`)           |
| `BETTER_AUTH_SECRET`   | api         | — (required, ≥ 32 chars)                  | `openssl rand -base64 32`; bootstrap generates one                      |
| `BETTER_AUTH_URL`      | api         | `http://localhost:3000`                   | Better Auth's base URL: the web origin, whose proxy reaches the api     |
| `WEB_URL`              | api, worker | `http://localhost:3000`                   | web origin: Better Auth's `trustedOrigins`; base of links in emails     |
| `STORAGE_DRIVER`       | api         | — (storage off)                           | `gcs`; unset, the api runs without storage (no `ObjectStorage`)         |
| `GCS_BUCKET`           | api         | — (required with `STORAGE_DRIVER`)        | `vulnscan` locally, `vulnscan-test` in `.env.test`                      |
| `GCS_API_ENDPOINT`     | api         | — (Google)                                | an emulator: `http://localhost:4443` (`fake-gcs`) locally               |
| `GCS_PROJECT_ID`       | api         | — (from the credentials)                  |                                                                         |
| `GCS_CREDENTIALS`      | api         | — (Application Default Credentials)       | a service account key's JSON; a secret                                  |
| `GOOGLE_CLIENT_ID`     | api         | — (Google sign-in off)                    | Google OAuth client; set with `GOOGLE_CLIENT_SECRET` or not at all      |
| `GOOGLE_CLIENT_SECRET` | api         | — (Google sign-in off)                    | a secret                                                                |
| `GOOGLE_SIGN_IN`       | web         | `false`                                   | `true` shows "Continue with Google"; only with the api's credentials    |
| `API_URL`              | web         | `http://localhost:3002`                   | where `next.config.ts` proxies `/api/*`; read by `getSession()`         |
| `RABBITMQ_URL`         | api, worker | `amqp://vulnscan:vulnscan@localhost:5672` | path = vhost; `.env.test` uses `/vulnscan_test` (must end `_test`)      |
| `JOB_RETRY_DELAYS_MS`  | worker      | `10000,60000,300000`                      | delay before each retry; parked after the last. `100,200,300` in tests  |
| `SMTP_URL`             | worker      | — (required)                              | `smtp://localhost:1025` (Mailpit) locally; Resend on Railway            |
| `MAIL_FROM`            | worker      | — (required)                              | From of every email: `address@domain` or `Name <address@domain>`        |
| `NEXT_DIST_DIR`        | web         | `.next`                                   | Next.js build directory; the browser tests use `.next-e2e`              |
| `E2E_MODE`             | e2e         | `dev`                                     | browser tests against `next dev` (`dev`) or a production build (`prod`) |

## Adding a variable

1. Add it to the schema in `packages/config/src/api.ts`, `web.ts`, or
   `worker.ts` (or `shared.ts` if all of them need it). Give it a default if a sensible one exists.
2. Add it to `.env.example`, and to `.env.test.example` only if tests need a
   different value. Existing developers get prompted for it the next time they
   run `script/bootstrap`.
3. Add its name to `globalPassThroughEnv` in `turbo.json`, or to a task's
   `env` if it changes build output (as `API_URL` does for web). Otherwise a
   value set in the shell won't reach Turbo tasks. No linter checks this.
4. Import it: `import { env } from "@repo/config/api"` → `env.MY_VAR`.
5. Update the table above.

## Client-side (browser) variables

`@repo/config/web` uses `node:fs`, so it must not be imported from client
components. There are no browser-side variables yet. If you need one, it must
be prefixed `NEXT_PUBLIC_` so Next.js inlines it at build time. Add a `client`
section to `web.ts` with `clientPrefix: "NEXT_PUBLIC_"`, and move the file
loading out of the client import path. Then update this page.
