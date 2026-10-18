# Development guide

## Prerequisites

- **Node.js** `^22.22.3 || ^24.15.0 || >=26` (24 LTS recommended). pnpm
  enforces this (`engineStrict: true` in `pnpm-workspace.yaml`); you'll get an
  "Unsupported engine" error otherwise.
- **pnpm 12** (`packageManager` in `package.json`). Install it globally for
  your Node version: `npm i -g pnpm@12`. See
  [Troubleshooting](troubleshooting.md#exec-format-error-from-turbo) if Turbo
  fails with "Exec format error".
- **Docker** with Compose v2, for Postgres, RabbitMQ, and Mailpit (and the
  optional GCS emulator the tests use).
- **OpenTofu and gcloud**, only to change the cloud resources in `infra/`
  (see [Infrastructure](infrastructure.md#install-the-tools)).

## First-time setup

```sh
script/bootstrap
```

It checks for pnpm and Docker, runs `script/update`, then creates `.env` and
`.env.test` from the `.example` files. It prompts for every value that is
empty or missing (example defaults are offered; secrets are typed hidden) and
generates `BETTER_AUTH_SECRET` if you leave it
empty. It also installs Chromium for the browser tests. Re-running it is
safe: existing values are kept, and only new or empty keys are prompted for.

Without a terminal (e.g. CI) it uses the defaults and generates secrets
without prompting.

## Running the app

```sh
script/server
```

One command starts everything:

- Postgres, RabbitMQ, and Mailpit via docker compose (detached; the script
  waits for their healthchecks),
- the api (`nest start --watch`) on http://localhost:3002,
- the web app (`next dev`) on http://localhost:3000,
- the worker (`nest start --watch`, no port), which sends queued emails,
- `tsc --watch` for the built `@repo/*` packages, so edits there reload the
  api and worker.

Emails land in Mailpit at http://localhost:8025; RabbitMQ's management UI is
at http://localhost:15672 (`vulnscan` / `vulnscan`). See [Messaging](messaging.md).

Ctrl-C stops all of it, including the containers (data is kept in the
`postgres-data` and `rabbitmq-data` volumes; Mailpit keeps nothing).

Stored files go to the GCS emulator (`fake-gcs`, http://localhost:4443),
which keeps them in memory: restarting the container empties it. See
[Storage](storage.md).

## Scripts

`script/` holds only the [Scripts to Rule Them All](https://github.com/github/scripts-to-rule-them-all)
entry points below. One-off, debugging, or app-specific scripts don't belong
there: check a behaviour with a test instead (see [Testing](testing.md)),
and put a CI-only helper in `.github/scripts/` (like `affected-apps`, which
the release workflow runs).

| Script             | What it does                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `script/bootstrap` | First-time setup (above).                                                                                                                                                                        |
| `script/server`    | Runs the whole app (above).                                                                                                                                                                      |
| `script/seed`      | Loads the sample users from `@repo/fixtures` into the dev database. Re-runnable. See [Database](database.md#fixtures-sample-data).                                                               |
| `script/test`      | Runs every workspace's test suites, including the browser tests; `-a=api` / `-a=web` / `-a=worker` / `-a=e2e` to pick apps (and their packages). See [Testing](testing.md).                      |
| `script/update`    | Updates every dependency to the newest version its `package.json` range allows and reinstalls. Never widens a range, so no major bumps; `@repo/*` is skipped. Review the diff before committing. |

Lower-level commands (from the repo root):

```sh
pnpm install
pnpm build          # turbo run build
pnpm check-types    # turbo run check-types
pnpm test           # turbo run test (unit and web tests, no integration)
pnpm lint           # oxlint --deny-warnings, whole repo
pnpm format         # oxfmt; pnpm format:check to verify
docker compose up -d --wait
```

Target one workspace with a filter: `pnpm exec turbo build --filter=api`, or
run a package script directly: `pnpm --filter api test`.

## Code quality

- **Lint: oxlint**, one root `.oxlintrc.json`. `correctness` rules are errors,
  `suspicious` rules warnings, and `--deny-warnings` makes any warning fail.
  Web also gets the react, jsx-a11y, and nextjs plugins; api,
  worker, and package tests get the vitest plugin. In the api and worker
  integration tests (`test/**`), `vitest/expect-expect` also counts any
  `.expect(...)` call (Supertest's) as an assertion. The browser tests
  (`apps/e2e`) get only the base rules.
- **Format: oxfmt** (`.oxfmtrc.json`, Prettier-compatible, `printWidth` 80).
  It also formats CSS, JSON, and Markdown, and sorts `package.json` keys.
- Neither tool checks that env vars are declared in `turbo.json`; do that by
  hand (see [Configuration](configuration.md#adding-a-variable)).

### Git hooks

[lefthook](https://lefthook.dev/) (`lefthook.yml`) installs two hooks when
`pnpm install` runs the root `prepare` script:

| Hook         | Does                                                                                                                                                                                                                                                                 |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | 1. **formats** the staged files with oxfmt (and `.tf` files with `tofu fmt`) and re-stages them; 2. then, in parallel, oxlint on the staged files and `check-types` for every package (when TypeScript, a tsconfig, a `package.json`, or `pnpm-lock.yaml` is staged) |
| `commit-msg` | [commitlint](https://commitlint.js.org/) (`commitlint.config.mjs`): `@commitlint/config-conventional` plus a `Story:` trailer on `feat`/`fix`                                                                                                                        |

Formatting never blocks a commit: it's applied and included. For a file with
both staged and unstaged changes, only the staged part is formatted into the
commit; the unstaged changes stay in your working tree. Lint errors, type
errors, and invalid commit messages do block the commit.

Type checking runs each package's `check-types` directly
(`pnpm -r run check-types`), not through Turbo, so it doesn't trigger a
`next build`.

Skip the hooks for one commit with `git commit --no-verify`, or set
`LEFTHOOK=0`. CI only runs the test suites, and only on release tags (see
[Deployment](deployment.md)), so nothing else catches lint, format, or type
errors a skipped hook would have. (The exception is `infra/`, whose
formatting and validity a workflow checks on pull requests, see
[Infrastructure](infrastructure.md#ci).) Committing a `.tf` file needs
`tofu` installed.

## Branches

One branch per task, created from an up-to-date `main` and named
`<type>/<short-description>` with a Conventional Commit type, e.g.
`fix/login-form-mobile`. A branch for a story starts with its ID, e.g.
`feat/S-0001-scan-targets`. Don't work on `main` directly.

A feature starts with its [story](stories/README.md), merged to `main` in its
own `docs` PR before work on the feature branch starts.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by the
`commit-msg` hook: `<type>(<scope>): <description>`, e.g.
`feat(web): add scan list page`. Use a workspace name (`web`, `api`,
`worker`, `ui`, `entities`, `config`, `fixtures`, `contracts`, `events`,
`storage`) as the scope when a change is limited to one. The type
and description are lower case, the description doesn't end with a period,
and body lines stay under 100 characters.

`feat` and `fix` commits end with a `Story: S-NNNN` trailer (one line per
story) naming a file in `docs/stories/`; the hook rejects them otherwise. See
[Stories](stories/README.md#linking-code-to-stories).

## Common tasks

### Add an environment variable

See [Configuration → Adding a variable](configuration.md#adding-a-variable).

### Add an entity

1. Create `packages/entities/src/<name>.entity.ts`. Use snake_case column
   names via `@Column({ name })`.
2. Add it to the `entities` array in `packages/entities/src/entities.ts` and
   export it from `src/index.ts`. `postgresOptions()` registers that array
   for the api and the worker.
3. In development, tables are created on api startup (`synchronize`); there
   are no migrations yet. See [Database](database.md).
4. If it needs sample data, add it to `packages/fixtures/src/data/` and load
   it in `apps/api/src/fixtures/seed-fixtures.ts`.

If you're running a single command outside Turbo after editing entities or
config, rebuild them first:
`pnpm --filter "./packages/*" build` (or name the packages:
`pnpm --filter @repo/entities --filter @repo/config build`).

Only the api creates tables (`synchronize`, development only). The worker
uses the same entities but expects the tables to exist, so start the api
(`script/server` does) after adding an entity the worker uses.

### Add or change a route contract

See [API contracts](contracts.md#adding-a-resource).

### Add an api module, controller, or service

Routes are implemented from `@repo/contracts`; see
[API contracts](contracts.md#adding-a-resource), and copy `src/account/` for
the module/controller shape. For anything that isn't an oRPC route, the
Nest generators work:

```sh
cd apps/api
pnpm exec nest g resource widgets
pnpm format   # generated code uses single quotes
```

The generators already write ESM imports with `.js` extensions and register
the new module in `AppModule`. Then:

- add `@AllowAnonymous()` to anything that must be public (all routes need a
  session by default),
- add an integration test under `apps/api/test/<feature>/`.

`nest g resource` with CRUD entry points also adds `@nestjs/mapped-types` to
`apps/api/package.json` with the version `*`; change it to a real range
(e.g. `^12.0.0`) before committing.

### Add a background job or message type

See [Messaging → Adding a job type](messaging.md#adding-a-job-type).

### Store files, or add a storage provider

The api's `StorageModule` provides `ObjectStorage` (see
[Storage → In the api](storage.md#in-the-api)): import it in your module,
inject `ObjectStorage` with `@Optional()` (it's missing when the api runs
without storage), and hand browsers signed URLs rather than proxying files
through the api. To support another provider (e.g. S3), see
[Storage → Adding a provider](storage.md#adding-a-provider).

### Add a web page

Add `apps/web/app/(app)/<route>/page.tsx` for a signed-in page (the layout
checks the session). Keep `page.tsx` a thin server component that exports
`metadata` and renders a container from `apps/web/containers/<feature>/`.
See [Web app](web.md). Add its route to `apps/e2e/tests/smoke.spec.ts`,
and a browser test of its main flow (see
[Testing → Browser tests](testing.md#browser-tests)).

### Test the PWA locally

`script/server` runs `next dev`, which never registers the service worker.
To try installing, caching, and the offline page, run a production build of
the web app (with the api running, e.g. from `script/server` in another
terminal, or on its own):

```sh
pnpm --filter web build
pnpm --filter web start          # http://localhost:3000; stop the dev web server first
```

`localhost` counts as a secure origin, so the worker registers and Chrome's
address bar offers to install the app. In DevTools → **Application**:
**Manifest** shows installability problems, **Service workers** shows the
active and waiting worker (tick "Update on reload" while iterating, or
press **Unregister** to remove a stale one), and **Storage → Clear site
data** removes the worker and its caches. **Network → Offline** shows the
offline page on the next navigation.

Pages always come from the network, so a rebuild shows on the next page
load. The rebuild's new worker (which caches the new offline page) waits
until every tab of the app is closed; close them, or press **skipWaiting**
in the Service workers panel. Going back to `next dev` on the same port
unregisters the production worker by itself on the first page load.

On a phone, the app needs HTTPS (a LAN address like `http://192.168.x.y`
isn't a secure origin, so there's no worker and no install prompt). Either
tunnel the production server (e.g. `cloudflared tunnel --url
http://localhost:3000` or `ngrok http 3000`, and set `WEB_URL` to the
tunnel's origin and restart the api, so Better Auth trusts it), or run
`pnpm --filter web exec next dev --experimental-https` to check the manifest
and layout (no worker in dev). Then use Chrome's install prompt on Android,
or Share → **Add to Home Screen** in Safari on iOS.

### Add a UI component

For a shadcn component: `cd apps/web && pnpm dlx shadcn@latest add <name>`,
then `pnpm format`. App-wide components go in `apps/web/components/`.

### Add a dependency

```sh
pnpm --filter <workspace> add <package>       # e.g. --filter api
pnpm --filter <workspace> add -D <package>
```

pnpm 12 rejects versions published less than 24 hours ago
(`minimumReleaseAge`). If a version you need is that new, pnpm adds it to
`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`; remove the entry once the
version is a day old.

### Update dependencies

```sh
script/update
pnpm build && pnpm check-types && pnpm lint && script/test
```

This stays within the `package.json` ranges (`^1.2.3` moves to the newest
`1.x`). `script/bootstrap` runs it too, so a fresh setup never crosses a major
version.

### Upgrade a dependency to a new major

A separate, deliberate job, on its own branch (e.g. `build/upgrade-next-17`):
change the range in the `package.json` files that use it (or run
`pnpm update --recursive --latest <name>` for that one package), reinstall,
read its changelog, and run the checks above. Don't run `pnpm update --latest`
without a package name: it upgrades everything, and pnpm 12 also bumps
TypeScript past the 6.x hold (see
[Decisions](decisions/typescript-held-at-6x.md)).
