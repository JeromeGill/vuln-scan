# Architecture

This is a pnpm + Turborepo monorepo with three apps, a browser test
suite, and seven internal packages.

```
vulnscan/
├── apps/
│   ├── web/          Next.js 16 (App Router, React 19) — port 3000
│   ├── api/          NestJS 12 (Express) + TypeORM + Better Auth — port 3002
│   ├── worker/       NestJS 12 app context (no HTTP): RabbitMQ job consumers (email)
│   └── e2e/          Playwright browser tests against all three — web 3100, api 3102
├── packages/
│   ├── config/       @repo/config    — validated env config (zod + @t3-oss/env-core)
│   ├── contracts/    @repo/contracts — oRPC route contracts (zod)
│   ├── entities/     @repo/entities  — TypeORM entities + shared DataSource options
│   ├── events/       @repo/events    — queue message schemas (zod → JSON Schema) + topology
│   ├── fixtures/     @repo/fixtures  — sample data for script/seed
│   └── storage/      @repo/storage   — object storage interface + the gcs driver
├── script/           bootstrap, update, server, seed, test
├── infra/            OpenTofu for the GCP resources (the bucket)
├── .railway/         railway.ts: the Railway deployment as code
├── docs/             this documentation
├── docker-compose.yml  Postgres 17, RabbitMQ 4.3, Mailpit, fake-gcs (GCS emulator)
└── tsconfig.base.json  compiler options every package extends
```

## Request flow

```
Browser
  │  http://localhost:3000
  ▼
apps/web (Next.js)
  │  pages: /login, /sign-up, /check-inbox, /verify-email, /dashboard
  │  /api/auth/*  ──rewrite (next.config.ts)──┐
  │  /api/*       ──rewrite → api root ───────┤
  │                                            ▼
  │                               apps/api (NestJS) :3002
  │                                 /api/auth/*  → Better Auth handler
  │                                 /account, … → Nest
  │                                   controllers implementing the
  │                                   @repo/contracts oRPC contracts
  │                                       (global auth guard)
  │                                            │
  │                               Better Auth ─┤ TypeORM adapter
  │                               Nest code ───┤ TypeORM repositories
  │                                            ▼
  │                                   Postgres (docker compose)
  │                                     auth schema: user, session,
  │                                     account, verification
  │                                     public schema: email_delivery
  │                                            ▲
  │                                            │ TypeORM (never syncs)
  │      RabbitMQ ──jobs (JSON)──▶ apps/worker ┘
  │      (vulnscan.jobs exchange)   │
  │                                    └──SMTP──▶ Mailpit (local) / provider
```

- The browser only ever talks to the web origin. Next.js rewrites proxy
  `/api/auth/*` to Better Auth and every other `/api/*` to the api root, so
  Better Auth's session cookie belongs to the web origin and no CORS is
  needed. See [Authentication](auth.md) and [Web app](web.md).
- In production builds the web app is an installable PWA: a service worker
  (`apps/web/public/sw.js`) caches its static assets and an offline page.
  Pages and `/api/*` always come from the network and are never cached. See
  [Web app → PWA](web.md#pwa).
- Every api route requires a session by default (a global guard from
  `@thallesp/nestjs-better-auth`); public routes opt out with
  `@AllowAnonymous()`.
- Better Auth reads and writes its tables through an in-repo TypeORM adapter
  (`apps/api/src/auth/typeorm-adapter.ts`), so the same entities and
  `DataSource` serve both Better Auth and app code. See [Database](database.md).
- Background work (sending email) goes through RabbitMQ to `apps/worker`,
  which reads the same database with the same entities but never changes the
  schema. Messages are JSON envelopes defined in `@repo/events`. The api
  publishes the email verification jobs (Better Auth's
  `sendVerificationEmail`). See [Messaging](messaging.md).
- Files go to object storage through `@repo/storage`'s provider-neutral
  `ObjectStorage` (a `gcs` driver, run against the `fake-gcs` emulator
  locally). The api's `StorageModule` provides it when `STORAGE_DRIVER` is
  set; no feature imports it yet. Browsers upload and download with URLs
  the api signs. See [Storage](storage.md).

## Workspaces

| Workspace         | Built?                                      | Consumed as                                      |
| ----------------- | ------------------------------------------- | ------------------------------------------------ |
| `apps/web`        | `next build`                                | —                                                |
| `apps/api`        | `nest build` → `dist/`                      | —                                                |
| `apps/worker`     | `nest build` → `dist/`                      | —                                                |
| `@repo/config`    | `tsc` → `dist/`                             | `@repo/config/shared`, `/api`, `/web`, `/worker` |
| `@repo/contracts` | `tsc` → `dist/`                             | `@repo/contracts`                                |
| `@repo/entities`  | `tsc` → `dist/`                             | `@repo/entities`                                 |
| `@repo/events`    | `tsc` → `dist/`, plus `dist/schemas/*.json` | `@repo/events`; JSON Schema for other languages  |
| `@repo/fixtures`  | `tsc` → `dist/`                             | `@repo/fixtures`, `@repo/fixtures/api`           |
| `@repo/storage`   | `tsc` → `dist/`                             | `@repo/storage`                                  |

- **`@repo/config`, `@repo/contracts`, `@repo/entities`, `@repo/events`,
  `@repo/fixtures`, and `@repo/storage` are built** because the compiled api
  and worker import them at runtime with plain Node. Their `exports` point `types` at
  `src/` (so type-checking needs no build) and `default` at `dist/`.
- Internal dependencies use pnpm's `workspace:` protocol (`workspace:*` or
  `workspace:^`, which behave the same inside the monorepo).

## Module system and TypeScript

- Everything is ESM (`"type": "module"`).
- **The api and worker are native ESM** (NestJS 12 is ESM-only): relative imports need the
  `.js` extension (`./account.module.js`), and so do deep imports into packages
  without an `exports` map (`supertest/types.js`). `main.ts` uses top-level
  `await`.
- All packages use TypeScript 6, strict, with `noUncheckedIndexedAccess`
  (`tsconfig.base.json`). Each package's `tsconfig.json` extends the base and
  adds its own options: Next.js settings in `apps/web`, decorators
  (`experimentalDecorators`, `emitDecoratorMetadata`) in `apps/api`,
  `apps/worker`, and `packages/entities`. Why not TypeScript 7: see
  [Decisions](decisions/typescript-held-at-6x.md).

## Configuration

All environment variables are declared and validated in `@repo/config`, which
also loads the repo-root `.env` files. Nothing else reads `process.env`. See
[Configuration](configuration.md).

## Build orchestration (Turborepo)

`turbo.json` defines `build`, `check-types`, `test`, `test:integration`,
`test:e2e`, and `dev`.

- `build`, `test`, `test:integration`, `dev`, and `seed` depend on `^build`, so the
  internal packages are compiled before anything that imports them. `seed`
  (api only, run by `script/seed`) is uncached.
- `dev` is persistent and uncached. `script/server` runs `dev` for
  `api...`, `web...`, and `worker...`, which includes the packages'
  `tsc --watch` tasks, so editing an entity rebuilds it and reloads the api
  and worker.
- `test:e2e` (the browser tests, `apps/e2e`) also depends on `api#build` and
  `worker#build`, since it runs their `dist/` builds; it's uncached.
- `apps/web/turbo.json` makes web's `check-types` wait for web's `build`
  (both write `.next/types`; see [Troubleshooting](troubleshooting.md)).
- Root files every package reads are `globalDependencies`, so editing them
  invalidates the cache (and marks every package affected; see
  [Deployment](deployment.md#skipping-unaffected-suites)): the `.env` files
  and their `.example`s, `tsconfig.base.json`, `docker-compose.yml`, the root
  `package.json`, and `pnpm-workspace.yaml`. Env var names are in `globalPassThroughEnv` so shell values reach
  tasks under Turbo's strict env mode.
- Lint (oxlint) and format (oxfmt) run once over the whole repo from the root,
  not as Turbo tasks.
