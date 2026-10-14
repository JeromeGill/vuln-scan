# Decisions

Short records of choices a future reader might otherwise question or undo.
Newest last. Add an entry when you make a similar choice; edit or supersede an
entry when the situation changes.

## In-repo TypeORM adapter for Better Auth

Better Auth has no official TypeORM adapter. The one published community
adapter had a single maintainer and supported only TypeORM 0.3. So
`apps/api/src/auth/typeorm-adapter.ts` implements Better Auth's adapter
interface (`createAdapterFactory`) on top of TypeORM repositories. It looks up
entities through an explicit model-key map rather than table names, so table
and schema naming stays in the entities.

## Better Auth tables in an `auth` schema

They were first prefixed (`ba_user`, …). They now live in a dedicated `auth`
schema under Better Auth's default names, which separates them from app
tables. Entity class names keep the `Ba` prefix to mark them as Better Auth's.

## Web proxies auth to the api

The web app rewrites `/api/auth/*` to the api instead of calling it
cross-origin. The session cookie is then first-party on the web origin, which
also lets server components read it later, and no CORS configuration is
needed.

## Env config package, loaded from repo-root files

`@repo/config` validates every variable with zod and loads the repo-root
`.env` files itself, so every app, test, and script sees the same values from
one place. `.env.test` holds only overrides and loads before `.env`.

## Integration tests use a separate `_test` database

Tests run against `app_test` on the same Postgres server. The global setup
creates it and refuses any database whose name doesn't end in `_test`. Test
cleanup deletes users, so this guard protects development data.

## oxlint and oxfmt instead of ESLint and Prettier

One root config each, run once over the repo; much faster. The shared
`@repo/eslint-config` and `@repo/typescript-config` packages were removed and
replaced by a root `tsconfig.base.json`. What was lost: the
`turbo/no-undeclared-env-vars` check (see
[Configuration](configuration.md#adding-a-variable)).

## TypeScript held at 6.x

TypeScript 7.0 ships only the `tsc` executable, not the compiler API. The Nest
CLI (`nest build`, `nest start --watch`) and `@nestjs/schematics` (`nest g`)
need that API, and `@thallesp/nestjs-better-auth` declares TypeScript
`^5.9 || ^6` as a peer. The `^6` range holds it: `script/update` only updates
within ranges. `updateConfig.ignoreDependencies` in `pnpm-workspace.yaml`
isn't enough on its own, because pnpm 12's `pnpm update --recursive --latest`
upgraded TypeScript to 7 despite it.

**Revisit when TypeScript 7.1 ships the API again and Nest supports it.**

## Strict Node engine and pnpm 12

`engineStrict: true` makes pnpm enforce the root `engines` range. That range
follows the strictest dependency (currently the Nest CLI's
`@angular-devkit/core`), so `script/bootstrap` doesn't check Node itself.
pnpm 12's default `minimumReleaseAge` (24h) is kept as supply-chain
protection.

## lefthook and commitlint for git hooks

lefthook runs the pre-commit checks in parallel from one YAML file and needs
no generated hook scripts in the repo. Formatting is fixed rather than
checked: the hook formats and re-stages the staged files, so formatting never
blocks a commit. Format and lint run on staged files only. Type checking covers the whole project, because a change in one file can
break another, and runs package `check-types` scripts directly instead of
through Turbo, where web's `check-types` waits for a full `next build`.
commitlint enforces the Conventional Commits rule from `CLAUDE.md`.

## Fixtures are data only; the api seeds them through Better Auth

`@repo/fixtures` holds plain data with no dependency on TypeORM or Better
Auth, so it could feed other consumers (tests, a web mock) later. The seeder
lives in the api because fixture users must be created through Better Auth
(`auth.api.signUpEmail`), which hashes passwords and writes the account rows;
only the api has the auth instance. It reuses the api's `DataSource` setup
(`initializeDataSource`) rather than booting Nest, and runs via
`nest start --entryFile seed` so the compiled ESM output is what runs.

## Contract-first api with oRPC

Routes are declared as oRPC contracts in `@repo/contracts` before they're
implemented, so the api and its clients share typed inputs, outputs, and
errors, and OpenAPI can be generated from the same definitions. The schemas
are written in zod independently of the TypeORM entities: the HTTP shape can
differ from the table, and browser code can import contracts without pulling
in TypeORM. Response types are suffixed `Dto` to avoid clashing with entity
class names.

## Contracts implemented with `@orpc/nest`

Routes are Nest controllers using `@orpc/nest`'s `@Implement`, rather than an
oRPC handler mounted outside Nest, so they sit behind the global Better Auth
guard and use Nest's DI, modules, and param decorators like any other route.
Services throw `ORPCError` directly instead of Nest HTTP exceptions, because
oRPC's interceptor (not Nest's exception filter) formats the response. Each
`@Implement` method takes an unused `@Res()`, which tells Nest the response
is handled; otherwise Nest replies again after oRPC, which fails on 204s.
Revisit if `@orpc/nest` fixes this upstream.

## Web UI stack

shadcn/ui on Tailwind v4 for components (copied into `apps/web`, not a
shared package, while there's one app; the Turborepo starter's unused
`@repo/ui` was removed), TanStack Table v9 for tables, TanStack
Form for forms, and TanStack Query via `@orpc/tanstack-query` for data. The
api client is generated from `@repo/contracts` with oRPC's `OpenAPILink`, so
the UI shares types and validation schemas with the api; forms validate with
the same zod schemas the api uses. Response dates use `z.coerce.date()` and
the client's `ResponseValidationPlugin`, because OpenAPI JSON carries dates
as strings. The api stays at its root and the web proxy maps `/api/*` onto
it, rather than prefixing every contract with `/api`.

## Env files located from the working directory

`@repo/config` originally resolved `.env` relative to its own file
(`import.meta.url`). That breaks once Next.js bundles it into server
components, so it walks up from `process.cwd()` to `pnpm-workspace.yaml`
instead. Every entry point (api, tests, scripts, `next dev`) runs inside the
repo, so this finds the same root.

## Stories in the repo instead of an issue tracker

Every feature has a user story in `docs/stories/`, rather than in Jira or
GitHub Issues. Stories are versioned and reviewed with the code, work offline,
and don't tie the project to a hosting provider. Commits link to them with a
`Story:` trailer, enforced for `feat` and `fix` by a commitlint rule that also
checks the story file exists, so `git log --grep` finds a story's changes.
Code comments don't reference stories because they go stale. Gherkin
`.feature` files were considered and skipped: numbered acceptance criteria and
test names that cite them give most of the traceability without the tooling.

## RabbitMQ job queue for background work

Background jobs (first: verification emails; later e.g. scans,
possibly in Python) go through RabbitMQ to separate workers
rather than running inside the api. RabbitMQ was chosen as a polyglot job
queue: per-message acks, prefetch, dead-lettering and TTLs give retries and
parking without extra infrastructure, and every language has a mature AMQP
client. Kafka was rejected because it's a log, not a job queue (no
per-message acks or retries; partitions bound parallelism) and heavier to
run; pg-boss and BullMQ because they tie consumers to Node (or to their
Postgres/Redis schema), which rules out a plain Python worker. Queues are
quorum queues, RabbitMQ 4's recommended durable type. See
[Messaging](messaging.md).

## amqplib directly, not Nest microservice transports

`@nestjs/microservices` wraps every message in its own
`{ pattern, data }` envelope and request/reply conventions, which a Python
consumer would have to imitate. The worker uses `amqplib` behind a small
Nest module (`apps/worker/src/messaging/`) and sends plain JSON bodies.
`@golevelup/nestjs-rabbitmq` (9.1, peer `@nestjs/core ^11 || ^12`) was
considered: it sends plain JSON, but pins the older `amqplib` 0.10 plus
`amqp-connection-manager` and lodash, and its error handling would have to
be bent to our retry topology. amqplib 2.x has connection recovery built in
(`recovery.setup` reruns topology and consumers after a reconnect), so the
remaining code is short and the retry rules are explicit.

## Message contracts as zod, exported as JSON Schema

`@repo/events` defines a fixed envelope (`id`, `type`, `version`,
`occurredAt`, `data`) and one zod schema per message type. TypeScript
producers and consumers validate with zod; the build emits JSON Schema
(`z.toJSONSchema`) plus the topology as JSON for other languages to generate
models from. Bodies are JSON-only (ISO strings for dates). Breaking changes
bump `version`; consumers park versions they don't handle. Protobuf/Avro
were skipped: JSON is readable in the RabbitMQ UI and needs no schema
registry at this size.

## Retries through per-attempt TTL queues

A failed job is republished by the consumer to `<queue>.retry.<n>` with a
per-message `expiration` and a `retry-count` header, then acked; the retry
queue dead-letters it back to the work queue when it expires. After the
last delay, or for a message that can't succeed (invalid, unknown type,
refused by the mail server), it goes to `<queue>.parked`. Rejected
alternatives: the delayed-message exchange plugin (not in the default
image, and its own durability caveats); `nack` into a dead-letter loop
counting `x-death` (can't add our own headers, and `x-death` is
broker-managed and differs between queue types); requeueing in place (no backoff, blocks nothing but
spins). One queue per attempt keeps every message in a queue on the same
delay, since TTLs only expire at the head. Delays come from config, not
queue arguments, so changing them doesn't break redeclaration. The work
queue's `x-delivery-limit` parks messages whose consumer keeps crashing.

## One DataSource setup, only the api changes the schema

The worker reads and writes the same tables with the same entities, so the
TypeORM options (`postgresOptions`) and the dev schema sync
(`synchronizeSchema`) moved from `apps/api/src/database.ts` into
`@repo/entities`, rather than the worker importing from `apps/api`. Only the
api calls `synchronizeSchema`: two processes altering the schema could race,
and a worker built from an older branch would drop newer columns. The sync
takes a Postgres advisory lock because the api and worker integration
suites now set up the same test database in parallel.

## Email delivery is claimed before sending

Queues deliver at least once, so the worker inserts a row keyed by the
message id into `email_delivery` before sending and marks it sent after;
a duplicate finds the row and is skipped (AC4 at the delivery layer). A
failed send deletes the claim so the retry can send. If a claim is stuck in
`sending` for longer than any send can take (10 minutes), the earlier
attempt died mid-send and the email may or may not have gone out; the
message is parked (`unknown-outcome`) rather than risking a duplicate.

## Email templates in React Email

Emails (so far the verification link) are React Email
components (`react-email`, rendered by `@react-email/render`) in
`apps/worker/src/email/templates/`, sharing `EmailLayout` and
`EmailButton` from `layout.tsx`. `renderEmail` renders each one twice: the
HTML, and the plain-text part converted from it, so the two can't drift
apart. This replaced hand-built HTML strings and plain text joined line by
line, which were hard to read and to change. React escapes values, and the
components produce the table markup mail clients need. Plain-text headings
come out in upper case (html-to-text's default). The worker compiles
`.tsx` with `"jsx": "react-jsx"`. `react-email` also ships a preview CLI;
its `esbuild` dependency's build script is turned off in
`pnpm-workspace.yaml`, since the worker doesn't run it.

## Integration, not e2e, for the api and worker suites

The api's and worker's Supertest/Vitest suites boot one app against real
Postgres, RabbitMQ, and Mailpit, but no browser or web app is involved, so
they are integration tests. They were called "e2e" (`*.e2e-spec.ts`,
`test:e2e`) after the Nest starter's naming, and are now
`test/**/*.integration.spec.ts`, `vitest.config.integration.ts`, and
`test:integration`, which leaves "e2e" for the browser suite (`apps/e2e`,
[Testing](testing.md#browser-tests)). The files keep a
`.spec.ts` ending so editors and tooling treat them as tests; the unit
configs only include `src/**/*.spec.ts`, so they never pick up the
integration files under `test/`.

## Object storage behind one interface, driver chosen by env var

The production storage provider isn't chosen, so `@repo/storage` defines a
small provider-neutral `ObjectStorage` (put, get, head, delete, delete by
prefix, signed upload and download URLs), and `STORAGE_DRIVER` picks the
driver when the app starts. So far there's one driver, `gcs`. Adding a
provider is a driver class and a config value; nothing else assumes GCS.
The interface stays to what GCS and S3 both do (string prefixes, signed
URLs with headers the client must send).

## Locally, the GCS driver against fake-gcs-server

The first version had a `local` driver writing files to disk, with its own
HMAC-signed URLs served by an api route, plus a `memory` driver: about 850
lines with no user yet, and several concurrency and stream-handling bugs.
`fake-gcs-server` (a docker compose service) speaks the GCS API, so local
development and tests use the same `gcs` driver as production would, with
`GCS_API_ENDPOINT` set. In that mode the driver creates the bucket and signs
URLs with a throwaway key, because the emulator checks neither. What it
can't show is whether real GCS accepts the signatures and enforces the
signed size and type limits, which needs one manual check against a real
bucket (see [Storage](storage.md)). The package has no Nest code: an app
that needs storage provides `ObjectStorage` with a factory calling
`createObjectStorage`, and none does until the first feature needs it, so no
app depends on the emulator before then.

## A PWA, not a native app

The mobile app is `apps/web` made installable, not a second app.
A PWA covers installing to the home screen, the camera
(`<input capture>` on iOS and Android), and Web Push (Android, and iOS
16.4+ once installed). It's one
codebase, and every improvement helps desktop too. React Native (Expo, as
`apps/mobile`) would mean a second UI to build and test for every feature,
Better Auth's Expo plugin instead of the cookie, app store accounts and
review, and Metro configuration that could change pnpm's `node-linker` for
the whole repo; `@repo/contracts` and the oRPC client would carry over, the
UI wouldn't. Capacitor needs a static or client-only web app, which
conflicts with the server components and server-side session checks.
Revisit if app store presence becomes a requirement, or the PWA falls short
on something that matters on real phones: uploads, push on iOS, or offline
writes.

## Hand-written service worker

The PWA's worker is a ~140-line `apps/web/public/sw.js` rather than
Serwist. `@serwist/next` is a webpack plugin, and Next.js 16 builds with
Turbopack. `@serwist/turbopack` (9.5) works around that by bundling the
worker with esbuild inside a route handler at build time, which adds
`@swc/core`, esbuild (native or wasm), and `@serwist/build` to the web app,
build scripts pnpm would have to be allowed to run, and a dependency on
Next.js build internals. What it buys, precaching the whole build manifest,
isn't needed: the requirements are cache-first hashed assets, network
navigations with one offline fallback page, and never touching `/api`.
Versioning is done without a build step: `next.config.ts` picks a random
version per build, and the worker is registered as `/sw.js?v=<version>`
(the value reaches client code through `lib/build.ts`, the one place the
web app reads `process.env`). Each build installs a new worker, which
caches that build's offline page and drops the previous one. Hashed assets
share one unversioned cache, since a hashed URL never changes content, so
nothing is downloaded twice across builds; the cache is trimmed to its
newest entries on activate. Deriving the version from git was tried and
cost more (git at config load in every phase, uncommitted changes, CI
variables) than it saved. The new worker doesn't `skipWaiting`, so a
running app never swaps workers mid-session; it takes over on the next
launch.
Revisit if offline writes or push need Workbox-style routing, background
sync queues, or precaching (Serwist would then be worth its weight).

## The service worker never caches api responses or pages

`/api/*` is passed straight through, and page navigations are network-only
with a static `/offline` fallback. Responses carry one user's data and the
Better Auth session, and a cache on a shared phone (or
after signing out) would show them to the next person; it also can't go
stale. The cost is that the app needs a connection to show any data;
offline reading or writing would be a separate, deliberate design.

## Web tests mock the network with MSW, in jsdom

`apps/web` component tests answer api calls with MSW (`setupServer`)
instead of mocking `lib/orpc.ts`, `lib/auth-client.ts`, or TanStack Query
with `vi.mock`. The code under test then runs as in the browser: the oRPC
client builds the request from the contract, `ResponseValidationPlugin`
parses the response (dates and all), errors decode into `ORPCError`s, and
Better Auth's client makes its real calls, so a test breaks when that
wiring does and not when a component is refactored. Handlers are
plain URL + JSON, and their bodies are typed from `@repo/contracts`.
Module mocks are kept for what doesn't exist outside Next.js
(`next/navigation`'s router).

jsdom rather than happy-dom: it's the environment Testing Library and
Radix are exercised against most, and its gaps are known and few (one
`matchMedia` stub so far). happy-dom is faster but less complete, and the
suite is small enough that speed doesn't matter yet. JSX is compiled by
Vite's own oxc transform (`oxc.jsx` in `vitest.config.ts`) rather than
`@vitejs/plugin-react`, since the tests need no Fast Refresh or Babel.

## Browser tests: Playwright in their own workspace, against the real stack

The web app's pages are tested end to end by `apps/e2e`, Playwright
driving Chromium against the real api, worker, Postgres, RabbitMQ, and
Mailpit. The component tests (MSW, above) don't replace it: what it has to
catch (React errors in
the console, hydration mismatches, layouts that break at phone width) only
shows up in a real browser on the real pages. It's a workspace of its own,
not part of `apps/web`, because it starts and needs all three apps. Choices
made with it:

- **Its own ports, database, and vhost, never reusing a server.** The
  suite starts the api on 3102 and web on 3100 with
  `reuseExistingServer: false`, against `app_e2e_test` (recreated on
  every run), so it can run while `script/server` is up and never tests or
  writes to someone else's server. `next dev` locks its build directory,
  so the web app takes `NEXT_DIST_DIR` and the suite uses `.next-e2e`.
- **Database setup before the api starts, not in `globalSetup`.**
  Playwright runs `globalSetup` after its web servers are up, and the api
  needs the database at startup, so `prepare.ts` runs in the api's
  `webServer` command.
- **`next dev` by default.** React reports hydration and rendering warnings
  only in development builds, which is most of what the console guard is
  for; `E2E_MODE=prod` covers production builds.
- **Every test fails on console errors and warnings, uncaught errors, and
  failed requests.** Exceptions live in one allowlist file with a reason
  each, scoped to the tests that cause them, so a new warning can't slip in
  unnoticed.
- **Data per test through the api, with one shared signed-in user.** Tests
  create what they need (unique emails and names) instead of
  relying on seeded fixtures, so they run in parallel and in any order. One
  user signed up by a setup project (`storageState`) saves a sign-up per
  test; tests that sign out or change settings sign up their own.
- **In a plain `script/test`.** The suite is the slowest (about a minute
  and a half), but it's the only test of the pages against the real stack, so it runs
  by default;
  `-a=e2e` runs it alone.

## Releases deploy from CI on a tag, not on pushes

The dev deployment on Railway updates only when a `v*` tag is pushed, and
only after every test suite passes in GitHub Actions
(`.github/workflows/release.yml`, see [Deployment](deployment.md)), rather
than Railway deploying each push to `main` itself. A release is then a
deliberate step, and a commit whose tests fail never reaches Railway.
Railway's own "wait for CI" option works per branch push, not per tag, so CI
deploys with `railway up` instead. The three services are always deployed
together: deploying only the apps a release changed would need per-app
change detection between tags, which isn't worth it yet.

The Railway project's settings and variables live in `.railway/railway.ts`
(Railway's Infrastructure as Code), applied by the release workflow before it
deploys, rather than in the dashboard: they're reviewed in PRs and can't
drift unnoticed. Railway's older Config as Code (`railway.json` per service)
is deprecated and new services can't opt in. The file owns the whole
environment, so the workflow applies without `--confirm-destructive`: a
change that would delete a service, volume, or variable fails the release
and has to be applied by hand after reviewing the plan. Secrets stay in the
dashboard as `preserve()`.

## Releases only run the suites of affected apps

A release tag runs the test suites of the apps affected since the last
release that passed, not all four (`.github/scripts/affected-apps`, see
[Deployment](deployment.md#skipping-unaffected-suites)). "Affected" comes
from Turbo's package graph, which follows the workspace dependencies that
pnpm's strict `node_modules` forces every import to declare, rather than
from path filters that would have to repeat that graph by hand and drift
from it. What the graph can't see is added explicitly: root files every
package reads are `globalDependencies`, e2e runs whenever an app it drives
is affected, and CI changes run everything. The base is the last release
whose workflow passed, so a failed release's suites run again. Deploys
still cover all three services.

## One api spec per endpoint, with shared request and response cases

The api's integration tests are one spec per contract route, whose
successful requests are cases in `@repo/fixtures/api`, so it's obvious
which routes are covered and with what, and the web component tests send
and mock the same requests and responses (how to write one:
[Testing](testing.md#testing-a-new-endpoint)). Grouping by resource was
tried first and grew into long files, each redefining the same helpers.

- **Cases live in `@repo/fixtures`**, next to the sample data they're built
  from, rather than in `apps/api/test/`, so the web tests (and a browser
  suite) can import them. The package depends on `@repo/contracts` for
  types only.
- **Cases are typed with the contract's own types**, with `response` a
  `Partial`, and no JSON mapped type: the spec parses the body with the
  `.strict()` response schema before `toMatchObject`, so dates are `Date`s
  on both sides and extra fields fail.
- **Unique values are parameters** of the case function
  (`createWidgetCases(unique)`), rather than static cases rewritten by a hidden
  helper or a clean database per run: the suites share one database and run
  in parallel with the worker's.
- **Cases never hold ids.** Case functions run when the spec is collected,
  before `beforeAll` creates anything, so a case names a related row
  (by a natural key) and the spec sends its id; path parameters come
  from the spec's setup.
- **Tests spanning endpoints** go in the spec of the endpoint whose response
  they assert. Rows each case needs are a `given` on the case; when the
  order of calls matters, or the route has no body or query, the spec uses
  a plain `it` with the builders instead of a case.
- **Invalid requests stay in the spec**, as one table per route: they're
  about this api's validation and errors, which the web app doesn't share.

## Email settings have no defaults

`SMTP_URL` and `MAIL_FROM` are required (`packages/config/src/worker.ts`),
where most variables have a local default. With a default (Mailpit on
`localhost:1025`), a deployed worker without its provider settings would
still start and then fail every send, parking every email, so mail would
be lost quietly. Without defaults it stops at startup instead and says
which variable is missing. Locally the values come from `.env`
(`.env.example` has Mailpit's). On startup the worker also checks the SMTP
login and logs the result (`SmtpMailerService`), but doesn't stop on a
failure, so a provider outage only delays email.

## Storage is optional in the api

The production storage provider isn't chosen, and the deployed app must
keep working until a bucket exists. So `StorageModule` provides
`ObjectStorage` only when `STORAGE_DRIVER` is set; services inject it with
`@Optional()` and answer a 503 when it's missing. Making the config required
would have stopped the deployed api at startup until a bucket and its
credentials were set up. With `STORAGE_DRIVER` set, a missing bucket still
fails startup, so a half-configured api doesn't run.

## GCP infrastructure in OpenTofu, applied by hand

Cloud resources outside Railway (so far the dev media bucket) are code in
`infra/`, with [OpenTofu](https://opentofu.org) rather than Terraform: the
same language and providers under an open-source licence (Terraform's is
the BSL). Railway's own Infrastructure as Code only covers Railway.
Each environment is one root (`infra/envs/dev`) in **its own GCP project**,
with shared resources in modules, so dev credentials (on Railway, on a
laptop) never reach production. Applies are done by hand after reading the
plan; CI only runs `fmt` and `validate`, with no credentials, because giving
GitHub Actions rights to change GCP isn't worth it for a resource that
changes a few times a year. See [Infrastructure](infrastructure.md).

## OpenTofu state: one bucket per environment, made by hand; the project too

Each environment's state is in a GCS bucket in that environment's project
(`gs://<project_id>-tfstate`), versioned, with the backend's native locking.
The bucket is created once with two `gcloud` commands: a bootstrap root
managing it would need its own state, kept locally or migrated into the
bucket it creates, which is more moving parts than two commands. The GCP
project is created by hand for similar reasons: linking billing needs the
billing account, and a root that creates its own project would need its
state elsewhere. Both are in [Infrastructure](infrastructure.md).

## Service account keys are created with gcloud, not OpenTofu

Railway can't use Workload Identity Federation (Google has no identity to
trust for a Railway container), so the api needs a service account key
(`GCS_CREDENTIALS`). Creating it with `google_service_account_key` would
store the private key in the state, readable by anyone who can read the
state bucket, and in every old version of it. Instead tofu creates the
account and its bucket role, and the key is made with
`gcloud iam service-accounts keys create -` piped straight into
`railway variable set`, so it's never written to disk. The cost: tofu
doesn't know about keys, so rotating or revoking one is a manual `gcloud`
step (see [Infrastructure](infrastructure.md#the-service-account-key)).

## The worker sends the verification email

Better Auth's `sendVerificationEmail` publishes an
`email.verify-email` job instead of the api sending over SMTP itself: all
outgoing email keeps one mailer, layout, retry policy, and delivery log in
the worker. The cost is the api's first RabbitMQ connection, a
publish-only `JobPublisher` in `apps/api/src/messaging/` rather than a
shared package (move it to one if a third app publishes), and the worker
skipping jobs whose link expired while they waited. The publish isn't
awaited, so a sign-up succeeds even when RabbitMQ is down; the user asks
for a new link.

## Better Auth's verification defaults, not custom checks

Expiry, reuse, and the "check your inbox" answer to an address that
already has an account all follow what Better Auth 1.7.7 does: a used link
redirects to the callback without a new session rather than showing an
error. The link's token is a signed JWT, so there's no table of tokens to
clean up.
