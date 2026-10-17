# Troubleshooting

## `Unsupported engine` on `pnpm install`

Your Node version is outside the root `engines` range
(`^22.22.3 || ^24.15.0 || >=26`), and `engineStrict` is on. Install a
supported version, e.g. `nvm install 24 && nvm alias default 24`, then
`npm i -g pnpm@12` for that Node.

## Exec format error from Turbo

```
ERROR  unable to spawn child process: Exec format error (os error 8)
```

pnpm 12 is a native binary. If an older global pnpm downloaded it (because of
`packageManager`), the step that swaps the placeholder `pnpm` file for the
real binary may not have run, so Turbo executes a text file. Install pnpm 12
properly for your Node version: `npm i -g pnpm@12`.

## `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`

pnpm 12 rejects versions published less than 24 hours ago. Either wait, use
an older version, or (if you trust it and need it now) let pnpm add it to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`. Remove the exclusion once
the version is a day old. If the lockfile has stale entries (e.g. a removed
package), run `pnpm clean --lockfile && pnpm install`.

## `nest build` / `nest g` fail with a TypeScript compiler API error

Something installed TypeScript 7, usually a `pnpm update --latest` run,
which pnpm 12 does despite `updateConfig.ignoreDependencies`. Keep it at 6.x
(see [Decisions](decisions/typescript-held-at-6x.md)): set every
`package.json` back to `"typescript": "^6.0.3"` and run `pnpm install`.
`script/update` stays within ranges, so it doesn't do this.

## `schema "auth" does not exist`

TypeORM's `synchronize` doesn't create schemas. `apps/api/src/database.ts`
creates them first, but only when `NODE_ENV !== "production"`. In production
the schema has to come from a migration.

## api fails at startup: `column "…" of relation "…" contains null values`

`synchronize` adds a new non-nullable column with a plain
`ALTER TABLE … ADD … NOT NULL`, which Postgres rejects when the table already
has rows. In development, delete the rows (for fixture data:
`DELETE FROM <table>;` in psql, then `script/seed`) or `docker compose down -v`.
Alternatively give the column a `default` or make it `nullable`. Migrations
will need to backfill instead.

## Next.js: `Module not found: Can't resolve ('../../../.env' …)`

Code that Next.js bundles (server components, route handlers) can't locate
files with `new URL(relativePath, import.meta.url)`: Turbopack treats it as
an asset import, and once bundled `import.meta.url` no longer points into the
repo. `serverExternalPackages` doesn't help for workspace packages. This is
why `@repo/config` finds the repo root from the working directory instead.

## Next.js build: "Dynamic filesystem access causes tracing of the whole project"

A dynamic `fs` call in bundled server code makes Next.js copy the whole repo
into the build's file trace. Mark calls that only read local-development
files with `/*turbopackIgnore: true*/` on every dynamic argument, as
`packages/config/src/shared.ts` does (including the `join(…)` that builds the
path).

## `ERR_HTTP_HEADERS_SENT` from an oRPC route

`Cannot remove headers after they are sent to the client`, logged by Nest's
`ExceptionsHandler`, typically on a 204. The `@Implement` method is missing
its `@Res() _res` parameter: oRPC already wrote the response and Nest is
replying again. Add the parameter (see `apps/api/src/orpc.ts`).

## `No TypeORM entity is mapped to model "…"`

Better Auth asked for a model the adapter map in
`apps/api/src/auth/auth.ts` doesn't contain, usually after enabling a plugin
that adds a model. Add an entity for it and add it to the map.

## Integration tests: "Refusing to run integration tests against …"

`DB_NAME` doesn't end in `_test`. Check `.env.test` (should contain
`DB_NAME=app_test`) and that `DB_NAME` isn't set in your shell; shell
values win over the files.

## Integration tests can't connect (`ECONNREFUSED 127.0.0.1:5432`)

Postgres isn't running. `script/test -a=api` starts it, or run
`docker compose up -d --wait`.

## Every api route returns 401

The global Better Auth guard requires a session. Mark public routes
`@AllowAnonymous()`, or send a session cookie (see [Testing](testing.md)).

## `403 INVALID_ORIGIN` from auth endpoints

The request's `Origin` isn't in Better Auth's `trustedOrigins`. Set `WEB_URL`
to the origin the web app is actually served from.

## web `check-types` fails: `.next/types/… not found`

`next build` and `next typegen` both write `.next/types`. If they run at the
same time, tsc misses files. `apps/web/turbo.json` orders them; if you see
this, check that file still makes `check-types` depend on `build`.

## `EADDRINUSE` on port 3000 or 3002

Something else is listening, often a leftover `next start` or `node
dist/main`. Find it with `ss -ltnp | grep -E ':(3000|3002)'` and stop it.

## Bootstrap doesn't prompt

It only prompts for keys that are missing or empty in your `.env`. Keys copied
from the example with a default are kept as they are. Without a terminal it
never prompts and uses defaults.

## Git hooks don't run

They're installed by the root `prepare` script, which pnpm skips when the
install is already up to date. Install them by hand:
`pnpm exec lefthook install`. Check with `ls .git/hooks` (`pre-commit` and
`commit-msg` should be there).

## A commit is rejected by commitlint

The message isn't a Conventional Commit. The error lists the failed rules
(e.g. `type-empty`, `subject-case`). Write it as
`type(scope): lower-case description` without a trailing period.

`story-trailer` means a `feat` or `fix` commit has no `Story: S-NNNN` line,
or names a story with no file in `docs/stories/`. Add the trailer on its own
line after a blank line (write the story first if it doesn't exist). If the
change isn't a feature or bug fix, use another type (`refactor`, `build`,
`chore`, …).

## `ERR_PNPM_IGNORED_BUILDS`

pnpm 12 blocks dependencies' install scripts until they're approved or
denied in `allowBuilds` (`pnpm-workspace.yaml`). Decide per package with
`pnpm approve-builds <pkg>` or `pnpm approve-builds '!<pkg>'`, and note why
next to the entry. `lefthook` is denied because its script only installs the
hooks, which `prepare` already does.

## An api error arrives as just "Bad Request" (or another status name)

The `ORPCError` was thrown with `message: undefined`, so oRPC fell back to
the status text. One way this happens: reusing an object passed to a zod
`.refine(fn, { message, path })` elsewhere. zod 4 normalizes refine params
in place (it moves `message` to `error` and deletes `message`), so the
shared object has no `message` once a schema has been built from it. Share
the message string, not the params object (export a `const …Message` next
to the schema).

## Emails take seconds to send locally (Mailpit)

Mailpit looks up the reverse DNS of every SMTP client before its greeting,
and from a Docker bridge address that lookup can take seconds per
connection. `docker-compose.yml` sets `MP_SMTP_DISABLE_RDNS=true` on the
`mailpit` service; if sends are slow, check it's still there and that the
container was recreated (`docker compose up -d --wait`).

## `PRECONDITION_FAILED - inequivalent arg` from RabbitMQ

A queue or exchange is being declared with different arguments than it
already has (e.g. after changing `queueArguments` in
`packages/events/src/topology.ts`, or a non-Node worker using other
values). RabbitMQ never changes an existing queue's arguments. In
development, delete the queue in the management UI
(http://localhost:15672) and restart the worker; elsewhere, migrate with a
new queue name or a policy.

## Worker logs `relation "email_delivery" does not exist`

The worker never creates tables; the api's development schema sync does.
Start the api once after pulling entity changes (`script/server` runs
both).

## Worker integration tests: "Refusing to run … RabbitMQ vhost"

`RABBITMQ_URL` in `.env.test` must name a vhost ending in `_test`
(`amqp://app:app@localhost:5672/app_test`). Run `script/bootstrap`
to add the missing key, and check `RABBITMQ_URL` isn't set in your shell.
If the global setup fails to reach the management API instead, RabbitMQ
isn't running: `docker compose up -d --wait`.

## `Bind for :::5432 failed: port is already allocated` from a git worktree

docker compose names the project after the directory, so a second checkout
(e.g. a git worktree) starts a second set of containers that clash with the
first on the published ports. Share the main checkout's containers with
`export COMPOSE_PROJECT_NAME=app`, and use a separate `DB_NAME` (and
vhost) in the worktree's `.env.test` if both checkouts run tests at once.
The failed project's containers are left in the `Created` state; remove
them with `docker compose -p <directory name> rm`.

## `vitest(expect-expect): Test has no assertions` on a Supertest test

oxlint's vitest rules only treat files named like tests (`*.spec.ts`,
`*.test.ts`) as tests, so they never ran on the old `*.e2e-spec.ts` files.
Since the rename to `*.integration.spec.ts` they do, and `expect-expect`
doesn't see `await api().get("/account").expect(401)` as an assertion. The
override for `apps/api/test/**` and `apps/worker/test/**` in `.oxlintrc.json`
sets `assertFunctionNames: ["expect", "**.expect"]`. In oxlint `*.expect`
only matches a single-segment callee (`foo.expect`); `**.expect` matches
chains like `api.get.set.expect`. A rules-only override also needs
`"plugins": ["vitest"]` itself, or its vitest rule settings are ignored.

## No install prompt or service worker on a phone

Service workers and installing need a secure origin: HTTPS or `localhost`.
`http://192.168.x.y:3000` is neither. Use an HTTPS tunnel; see
[Development guide → Test the PWA locally](development.md#test-the-pwa-locally).
Also check DevTools → Application → Manifest for installability errors.

## Railway deploy job hangs: "no changes detected in watch paths, build will skip"

`railway up --ci` waits for a build that Railway skipped: the service has
watch paths, and an upload from the CLI has no git diff to match them
against. `.railway/railway.ts` keeps them empty, so they were set in the
dashboard since the last release; apply the config. See
[Deployment → Troubleshooting](deployment.md#troubleshooting).

## Worker on Railway: `SMTP server smtp.resend.com:465 check failed: Connection timeout`

Railway blocks outbound connections on the standard SMTP ports (465 and 587
time out from the worker; checked 2026-10-12), so every send fails with
`Connection timeout` and the digest is retried, then parked. Use Resend's
alternative port: `SMTP_URL=smtps://resend:<api key>@smtp.resend.com:2465`
(see [Deployment](deployment.md#email)). To check which ports the worker
can reach:

```sh
npx @railway/cli ssh --service worker -- node -e 'const s=require("net").connect(2465,"smtp.resend.com");s.setTimeout(8000);s.on("connect",()=>{console.log("open");s.destroy()});s.on("timeout",()=>{console.log("timeout");s.destroy()})'
```
