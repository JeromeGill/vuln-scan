# Testing

## Running tests

```sh
script/test            # every workspace (apps and packages)
script/test -a=api     # one app (also: -a api, --app=api; repeatable)
script/test -a=web
script/test -a=worker
script/test -a=e2e     # the browser tests only
script/test --help
```

`script/test` starts the docker compose services (Postgres, RabbitMQ,
Mailpit, and the `fake-gcs` emulator) and runs every workspace's unit and
integration suites, including packages no app uses yet (`@repo/storage`).
With `-a`, it runs only those apps and the packages they use (`-a=web`
needs no compose services, so it doesn't start them). A plain `script/test`
also runs the [browser tests](#browser-tests), the slowest suite (`-a=e2e`
runs only them). The api and worker integration suites run
in parallel; they share the test database but use unique data.

Directly, from the repo root:

```sh
pnpm --filter api test                                        # unit
pnpm --filter api test:integration                            # integration (needs Postgres)
pnpm --filter api test:integration test/account/get-account.integration.spec.ts  # one file
pnpm --filter api test:integration -t "rejects invalid"       # by name
pnpm --filter api test:watch                                  # unit, watch mode
pnpm --filter worker test                                     # worker unit
pnpm --filter worker test:integration                         # worker integration (needs compose)
pnpm --filter @repo/storage test                              # storage key validation
pnpm --filter @repo/storage test:integration                  # gcs driver vs the fake-gcs emulator
pnpm --filter web test                                        # web components (jsdom, api mocked)
pnpm --filter web test:watch                                  # web, watch mode
```

## What exists

| Suite                       | Location                                      | Config                         | Needs DB                       |
| --------------------------- | --------------------------------------------- | ------------------------------ | ------------------------------ |
| api unit                    | `apps/api/src/**/*.spec.ts`                   | `vitest.config.ts`             | no                             |
| api integration             | `apps/api/test/**/*.integration.spec.ts`      | `vitest.config.integration.ts` | yes                            |
| worker unit                 | `apps/worker/src/**/*.spec.ts`                | `vitest.config.ts`             | no                             |
| worker integration          | `apps/worker/test/**/*.integration.spec.ts`   | `vitest.config.integration.ts` | yes, plus RabbitMQ and Mailpit |
| `@repo/storage` unit        | `packages/storage/src/**/*.spec.ts`           | `vitest.config.ts`             | no                             |
| `@repo/storage` integration | `packages/storage/test/*.integration.spec.ts` | `vitest.config.integration.ts` | the `fake-gcs` emulator        |
| web                         | `apps/web/test/**/*.spec.{ts,tsx}`            | `vitest.config.ts`             | no (api mocked with MSW)       |
| browser (Playwright)        | `apps/e2e/tests/*.spec.ts`                    | `playwright.config.ts`         | yes, plus RabbitMQ and Mailpit |

The api, worker, and packages use **Vitest** with globals (`describe`, `it`, `expect`). Integration
tests are grouped by feature (`test/auth/sign-up.integration.spec.ts`,
`test/auth/sign-in.integration.spec.ts`, `test/account/get-account.integration.spec.ts`, …).
The api's unit specs cover code with no Nest or database, so far
`src/upload-tokens/upload-token.spec.ts` (generating and hashing upload
tokens, and their expiry).
`test/fixtures/seed-fixtures.integration.spec.ts`
loads all of `@repo/fixtures` into the test database (and removes it
afterwards), so a broken fixture fails the suite.

Integration specs end in `.integration.spec.ts` and live under `test/`; the
unit configs only include `src/**/*.spec.ts`, so `pnpm --filter api test`
never runs them. These suites used to be called "e2e" (`*.e2e-spec.ts`,
`test:e2e`); that name now means the [browser tests](#browser-tests), see
[Decisions](decisions/integration-not-e2e-for-the-api-and-worker-suites.md).

## How integration tests run

- They boot the real `AppModule` with `@nestjs/testing` and call it over HTTP
  with Supertest.
- Vitest sets `NODE_ENV=test`, so `@repo/config` loads `.env.test` on top of
  `.env`: same settings, but `DB_NAME=vulnscan_test`.
- `test/global-setup.ts` runs once before the suites. It creates the
  `vulnscan_test` database on the docker-compose Postgres server if it doesn't
  exist, and **refuses to run if `DB_NAME` doesn't end in `_test`**, so tests
  can never touch the dev database.
- Tables are created by the api's schema sync when `AppModule` starts.
- Files run serially (`fileParallelism: false`) because they share one
  database.

## Worker integration tests

`apps/worker/test/` boots the real `WorkerModule` (`createWorker()` in
`test/helpers/worker.ts`, optionally with a `TestMailer` that fails on
demand) against real services:

- **Database:** the same test database as the api. The worker never
  synchronizes, so `test/global-setup.ts` creates the database if needed and
  syncs the schema itself (`synchronizeSchema` from `@repo/entities`, under
  the same advisory lock the api uses).
- **RabbitMQ:** a separate vhost, from `RABBITMQ_URL` in `.env.test`
  (`/vulnscan_test`), so a worker running from `script/server` never consumes
  test messages. The global setup creates it through the management API
  (port 15672) and **refuses a vhost whose name doesn't end in `_test`**.
- **Short retries:** `JOB_RETRY_DELAYS_MS=100,200,300` in `.env.test`.
- **Mailpit:** tests find emails through its HTTP API
  (`test/helpers/mailpit.ts`, `http://localhost:8025/api/v1`), searching by
  the unique recipient address. Its `Text` comes back with `\r\n` line
  endings; the helper normalizes them.
- Users are inserted straight into `auth.user` (allowed for test setup; the
  worker has no Better Auth instance) and deleted in `afterAll`.
- `QueueInspector` opens its own connection to purge or drain a queue, e.g.
  to assert on `email.parked`.
- A job that scans the database (e.g. a scheduled one) should take the
  ids to look at and "now" as parameters, so its tests only see their own
  rows: the api suite writes to the same database in parallel.

## Storage in tests

`packages/storage/test/gcs.integration.spec.ts` runs the `gcs` driver
against the `fake-gcs` emulator (`script/test` starts it), in its own
`vulnscan-storage-test` bucket and under a unique key prefix per run.

The api's specs store files in the emulator too: `.env.test` points
`GCS_BUCKET` at a `vulnscan-test` bucket (`.env` must point
`STORAGE_DRIVER` and `GCS_API_ENDPOINT` at it, as `.env.example` does).
`test/uploads/create-upload.integration.spec.ts` reads the stored lockfile
back with `app.get(ObjectStorage)`, and `createApp({ storage: false })`
boots the api without `ObjectStorage`, as without `STORAGE_DRIVER`, for
the 503. A browser-upload feature's specs would upload like the browser:
request an upload, PUT bytes to the signed URL, and complete it; the
emulator doesn't check signatures.

## Writing integration tests

Name a test written for a story's acceptance criterion after it:
`it("S-0001 AC2: rejects a duplicate name")`. Then
`pnpm --filter api exec vitest run -t S-0001` runs that story's tests (see
[Stories](stories/README.md#linking-code-to-stories)).

For api routes, use the helpers in `test/helpers/`. `app.ts`:

- `createApp()` boots `AppModule` as `main.ts` does (`bodyParser: false`,
  which Better Auth needs), with `publisher`, a `FakeJobPublisher`, in place
  of the api's `JobPublisher`, so the specs need no RabbitMQ. It keeps the
  published jobs; `publisher.verificationLink(email)` gives the newest
  verification link's path and query.
- `signUp(app, label)` creates a unique user and returns its id, email, and
  session cookie. Sign-up doesn't sign in, so it opens the link
  from the user's verification email, which verifies and signs in: the real
  flow, one extra request. `signUpUnverified(app, email)` stops before the
  link.
- `deleteUsersAndClose(app, users)` is the `afterAll`; `uniqueEmail()`
  gives an address that won't collide. It calls `deleteUsers(dataSource,
  emails)`, which also deletes the users' (personal) organizations, since
  those don't cascade from the user.

`test/helpers/builders.ts` creates the rows a spec needs through the api
(so far `createProject`, `createUploadToken`, and `uploadLockfile`, with
`postUpload` beneath it for specs that send invalid uploads; see
[Testing a new endpoint](#testing-a-new-endpoint)).

The integration tests run with dummy Google credentials
(`vitest.config.integration.ts`), so Google sign-in is on; the Google spec
mocks Google's token endpoint with MSW's node server
(`test/auth/google.integration.spec.ts`), letting every other request
through.

### One spec per endpoint

Every contract route has its own spec file in `apps/api/test/<resource>/`,
and its successful requests come from cases in `@repo/fixtures/api` that
the web tests share (why: see
[Decisions](decisions/one-api-spec-per-endpoint-with-shared-request-and-response-cases.md)).
Every new route gets the same: follow the checklist below.
`test/projects/` is the model to copy: `create-project` and
`rename-project` run cases (rename's with a `given`), `list-projects` runs
query cases, and `get-project` and `delete-project` take no body or query,
so plain `it`s. `test/account/get-account.integration.spec.ts` is the
smallest (no input, one user).

#### Testing a new endpoint

1. **Fixture cases, if the route takes a body or query.** One file per
   route in `packages/fixtures/src/api/<resource>/`, named after the
   contract key in kebab case (`widgets/create.ts` for
   `widgetsContract.create`; a nested key verb first,
   `widgets/update-settings.ts` for `widgetsContract.settings.update`),
   exported from `src/api/index.ts`. Skip it when nothing in the body is
   known before the spec runs (e.g. a token signed for the spec's user).
   - It exports a function named after the route (`createWidgetCases`)
     returning `ApiCase<Request, Response>[]` (`src/api/case.ts`), with the
     return type annotated: each case is a `label`, the `request` body or
     query, and the expected `response`, a `Partial` without generated
     fields (ids, timestamps).
   - `Request` and `Response` are the contract's exported types:
     `CreateWidget`, `Partial<ListWidgetsParams>` for queries (defaulted
     fields are required in the zod output), `WidgetDto`,
     `Page<Partial<WidgetDto>>` for lists. Never a JSON or deep-partial
     mapped type: the spec parses the body, so dates are `Date`s on both
     sides. Use `satisfies` only to keep a literal type.
   - Values come from the sample data in `src/data/`. Unique values are the
     function's parameters (`createWidgetCases(unique)`), and so is `today`
     when the response depends on the date.
   - Cases never hold ids. Path parameters come from the spec's setup; a
     body or query field that refers to another row names it by a natural
     key instead, and the spec sends that row's id.
   - Rows every case assumes are exported next to the cases. Rows each case
     needs of its own go in a `given` on an extended case type, which the
     spec creates before the request.
   - Export a named constant for a response the web tests mock rather than
     indexing into a case array.
2. **The api spec**, `apps/api/test/<resource>/<verb>-<noun>.integration.spec.ts`
   (`create-widget`, `get-account`), with ``describe(`POST ${widgetsPath}`)``
   built from the path constant in `@repo/contracts` (`accountPath`; a new
   resource exports its own and uses it in `.prefix(…)`). Name it after the
   contract key like the case file, adding the resource.
   - `beforeAll`: `createApp()`, `signUp` an `owner` and an `other` user,
     then the rows the cases assume, made with builders in
     `test/helpers/builders.ts`. Builders go through the api and return the
     parsed response; add one when a spec needs it, not before, and don't
     define helpers like these in a spec. Resources that aren't owned need
     only one user. `afterAll(() => deleteUsersAndClose(app, [owner, other]))`.
   - Success: `it.each(xCases(…))("$label", …)` sends the request as the
     owner, parses the body with the contract's response schema made
     `.strict()` (extra fields such as `userId` fail; dates become
     `Date`s), and `toMatchObject(response)`, adding what only the spec
     knows (ids). A case that changes state, or has a `given`, gets fresh
     rows, so order doesn't matter. A route without a body or query keeps
     plain `it`s instead.
   - Invalid requests: one `it.each` table in the spec, rows `{ label,
     cookie?, body | query, status, code, message? }` plus any other
     override the route needs. Overrides are thunks
     (`cookie: () => other.cookie`) because the users and rows exist only
     after `beforeAll`; the handler defaults them (`cookie = () =>
     owner.cookie`). Every route has a `requires a session` row (401, with
     `code: undefined` and the comment that Better Auth's guard replies
     with Nest's error body) unless it's public (`@AllowAnonymous()`: say so
     in a comment), and every route with an id of an owned resource a 404
     row for another user's. Where a rejected write could still change
     something, the handler also checks the row is unchanged.
   - Keep story labels (`S-0001 AC1: …`) in the case or row `label`, so
     `vitest run -t S-0001` still finds them.
3. **Behaviour across endpoints.** A test goes in the spec of the endpoint
   whose response it asserts, whatever it calls to set up. When the order
   of calls matters or the route has no body or query, write a plain `it`
   with the builders rather than a case.
4. **Web tests**, if the web app calls the route (see [Web](#web)): a form
   test runs the cases, typing each `request` into the form and expecting
   exactly that body to be sent, and the MSW handler answers with the
   case's `response` filled out by an `aX(fields)` builder in
   `apps/web/test/server.ts` (like `anAccount(fields)`); add one for a new
   response type, with the first fixture's values as defaults. List mocks
   use the exported response constants or the cases' responses.
   - Write each case's `request` as the full body the web sends, with the
     fields a form fills in or defaults spelled out (`note: null`): it's
     valid api input too, and the web test can then expect
     `toEqual(request)`, never a looser match.
   - When a form can't send some cases, run it on the others with a
     `filter` and a comment saying why.
   - A form that sends every field (an edit form) expects the edited
     record's values with the case's `request` on top.

`vitest list` reads the spec statically and prints `$label` for `it.each`
rows; to see the expanded names, run the spec with `--reporter=verbose`.
When changing or replacing specs, map every removed `it` to the case or row
that covers it in the PR description, so no coverage is lost.

### General rules

- **`bodyParser: false` is required**, as in `main.ts`; Better Auth needs the
  raw body.
- Use **unique data per run** (e.g. ``const email = `sign-up-${Date.now()}@example.com` ``)
  so suites don't collide with leftovers.
- **Take sample values from `@repo/fixtures`** rather than making them up:
  `signUp` names users after a fixture user, and so does the worker's
  `createUser`. Only the values are shared: each test still creates its own
  rows, and the fixture set is never seeded except by
  `seed-fixtures.integration.spec.ts`. Keep deliberate values (boundaries,
  dates, odd names for escaping) inline.
- **Exercise behaviour through the public API** (HTTP endpoints, or Better
  Auth for auth state). Reading entities to assert results is fine.
- **Clean up in `afterAll`.** Fixture setup and teardown may write to the
  Better Auth tables directly (e.g. `getRepository(BaUser).delete({ email })`;
  sessions and accounts cascade). This is the only exception to the rule that
  Better Auth tables are written only through Better Auth (see
  [Authentication](auth.md#rules)).
- Remember the global auth guard: routes without `@AllowAnonymous()` return
  401 without a session cookie. To test a protected route, sign up or sign in
  first and send the `Set-Cookie` value back (see `sign-in.integration.spec.ts`).

## Unit tests

Put `*.spec.ts` next to the code. In a package, import `describe`/`it`/
`expect` from `vitest` (packages don't enable globals) and keep specs out of
the build with the package's `tsconfig.build.json`; see
`packages/storage/src/keys.spec.ts`. In an app, use
`Test.createTestingModule` with only the providers you need, or test plain
functions directly (see `apps/worker/src/messaging/retry.spec.ts`). Unit
tests must not need the database.

## Web

`apps/web/test/` holds component tests: Vitest in a jsdom page,
[Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
to render and interact, and [MSW](https://mswjs.io/) to answer the api
calls. `pnpm --filter web test` runs them, and so do `pnpm test` and
`script/test -a=web`. They need no running api or database.

- **Test what the user sees, not how it's built.** Render a container (or a
  form) and drive it the way a user would: find elements by role, label,
  or text (`getByRole("button", { name: "Log in" })`,
  `getByLabelText("Email")`) and act with `userEvent`. Assert on the page:
  rows, validation messages, toasts, dialogs opening and closing, what the
  api was sent. Don't assert on hooks, component state, or props.
- **Mock the network, not modules.** `test/server.ts` exports an MSW
  `server`; each test adds handlers for the `/api/*` routes it needs with
  `server.use(http.get("/api/account", …))`. The real oRPC client (with
  `ResponseValidationPlugin`), Better Auth client, and TanStack Query run,
  so a response that doesn't match the contract fails like it would in the
  browser. A request without a handler fails the test.
- **Type the mock responses from the contracts.** `ApiOutputs["account"]["get"]`
  (from `test/server.ts`) is a route's response type; `anAccount(fields?)`
  builds an `AccountDto` from the first fixture user with `fields` on top
  (`aProject(fields?)` a `ProjectDto` from the first fixture project,
  `anUploadToken(fields?)` an `UploadTokenDto` and
  `aCreatedUploadToken(fields?)` the create response with its `token`);
  `apiError({ code, status, message, … })` sends an oRPC error like the api
  does (e.g. a `CONFLICT`).
- **Use the api's fixture cases** (`@repo/fixtures/api`, see
  [One spec per endpoint](#one-spec-per-endpoint)) where a test sends what
  an api spec sends or mocks what it returns, so the web tests and the api
  specs agree on the requests and responses.
- `test/render.tsx`'s `renderWithProviders(ui)` wraps `ui` in what the
  containers need from `app/providers.tsx`: a fresh `QueryClient` per test
  (no retries) and the toaster.
- The page's origin is `http://app.test` (`vitest.config.ts`), so a
  request that slips past MSW can't reach a dev server on localhost.
- Stubs are kept to what jsdom or a test can't provide, with a comment:
  `window.matchMedia` in `test/setup.ts` (sonner reads it), pointer capture
  and `scrollIntoView` there too (Radix's Select and DropdownMenu call
  them). Open a Select from the keyboard (`user.tab()` to it, then
  `{Enter}`) and then click the `option`: jsdom puts every pointer event at
  (0, 0), so after a click on the field Radix takes the option's click for
  the same press and ignores it (see
  `test/upload-tokens/create-upload-token-dialog.spec.tsx`), and
  `next/navigation`'s `useRouter` (or `useSearchParams`, read from
  `window.location`) in tests of components that navigate or read the URL
  (there's no Next.js router outside `next dev`/`next start`).
- Sonner keeps toasts in module state and shows the active ones to the
  next toaster, so `test/setup.ts` dismisses them after each test.
- MSW is started at the top of `test/setup.ts`, not in `beforeAll`:
  `lib/orpc.ts` keeps a reference to `fetch` when it's imported, which
  happens before `beforeAll` runs.
- Specs end in `.spec.tsx` (`.spec.ts` for plain functions) and are
  grouped by feature (`test/auth/`, `test/dashboard/`, `test/projects/`,
  `test/upload-tokens/`).

The pages are tested together, in a real browser, by the
[browser tests](#browser-tests).

## Browser tests

`apps/e2e` runs the real app in Chromium with Playwright: every route signed
out and signed in, and the main flow of each story with a UI, on desktop
Chromium and on a phone viewport (Pixel 7). A test fails if the page logs a
console error or warning, throws an uncaught error, or has a failed request.

```sh
script/test -a=e2e                                   # builds what it needs, starts compose, runs the suite
pnpm --filter e2e test:e2e                           # the same, if the api and worker are built and compose is up
pnpm --filter e2e test:e2e tests/accounts.spec.ts    # one file
pnpm --filter e2e test:e2e -g S-0001                 # one story's tests
pnpm --filter e2e test:e2e --project=phone           # one viewport
pnpm --filter e2e test:e2e --ui                      # Playwright's UI mode, to watch and step through
E2E_MODE=prod pnpm --filter e2e test:e2e             # against next build + next start
```

`script/bootstrap` installs Chromium (`pnpm --filter e2e exec playwright
install chromium`); on Linux, add `--with-deps` once if it's missing system
libraries.

### How it runs

- **Its own servers.** `playwright.config.ts` starts the api (port 3102), the
  worker, and the web app (port 3100) through `webServer`, with
  `reuseExistingServer: false`, so it never tests (or touches) the
  `script/server` processes on 3000/3002, and fails if 3100 or 3102 is
  taken. The web app gets its own build directory (`NEXT_DIST_DIR=.next-e2e`)
  so its `next dev` can run next to `script/server`'s.
- **Its own data.** `prepare.ts` runs before the api starts and recreates
  the `vulnscan_e2e_test` database and RabbitMQ vhost, refusing names that
  don't end in `_test`; the api creates the tables when it starts.
  (Playwright's `globalSetup` only runs once the web servers are up, too
  late for this.)
  The api and worker need building first: `script/test` (Turbo's
  `test:e2e` task) builds them.
- **Dev mode by default.** React only reports hydration and rendering
  warnings in development, so the web app runs with `next dev`.
  `E2E_MODE=prod` runs `next build && next start` instead, to catch
  production-only problems (and to test the service worker, which is only
  registered in production builds).
- **Signed in by default.** The `setup` project (`tests/auth.setup.ts`)
  signs a user up through the api (`signUp`, which opens the verification
  link from Mailpit, so the whole chain api → RabbitMQ → worker → Mailpit
  runs) and saves its session to
  `apps/e2e/.auth/user.json` (`storageState`); the `desktop` and `phone`
  projects start every test with it. Tests that sign out or change the
  user's settings sign their own user up (`signUp(page.request)`) and clear
  the shared state with `test.use({ storageState: { cookies: [], origins: [] } })`.
- **Data per test, through the api.** `helpers/api.ts` creates data with
  `page.request`, which shares the page's cookies, so it belongs to the
  signed-in user (so far `signUp`, `createProject`, and `createUploadToken`;
  add a helper per resource as tests need them). Values are unique and come from `@repo/fixtures`. Tests run
  in parallel and share the user, so find your own rows rather than
  counting everything on a page.
- **Storage:** the api is configured with the `fake-gcs` emulator, in its
  own `vulnscan-e2e-test` bucket (`settings.ts`); browsers upload to it on
  `localhost:4443` directly.
- **Email** is read from Mailpit's API by the unique recipient and the
  subject (`helpers/mailpit.ts`; every user gets a verification email).

### The console guard

`fixtures.ts` replaces Playwright's `page` with one that records console
errors and warnings, uncaught errors, and failed requests, and fails the
test after it runs. Import `test` and `expect` from `../fixtures.ts`, never
from `@playwright/test`. An expected problem (e.g. Chrome logging the 401 of
a deliberately wrong password) goes in `console-allowlist.ts`, with a
`reason`, and is scoped to the tests that cause it with `test` (a pattern on
the test title).

### Debugging a failure

A failed test keeps a trace, a screenshot, and a video in
`apps/e2e/test-results/` (gitignored), and the HTML report is written to
`apps/e2e/playwright-report/`:

```sh
pnpm --filter e2e exec playwright show-report                  # the report, with each failure's trace
pnpm --filter e2e exec playwright show-trace test-results/<test>/trace.zip
pnpm --filter e2e test:e2e --debug -g "S-0001 AC1"             # step through in a headed browser
```

The servers' stderr is printed to the terminal, prefixed `[api]`,
`[worker]`, and `[web]`; run with `DEBUG=pw:webserver` to see all their
output.

### Adding a test

- A story that changes the UI isn't done until its main flow has a browser
  test (see [Stories](stories/README.md)). Name it after the criterion it
  covers: `test("S-0001 AC3: deletes a widget", …)`, one file per area in
  `apps/e2e/tests/`.
- Create the data the test needs through `helpers/api.ts`, then drive the UI
  the way a user would: roles and labels (`getByRole`, `getByLabel`), not CSS
  classes. Give row menus an `aria-label` naming the row
  (`Actions for <name>`) so tests can reach them.
- Write it so it passes on both projects: columns hidden on phones aren't
  there to click, so prefer the actions menu.
- Keep helpers small; add one only when two tests need it.
  `helpers/layout.ts` has the 360 px checks (`expectToFit`: neither the
  page nor a table scrolls sideways; `expectWithin`: a dialog fits the
  screen).
- A test that copies to the clipboard grants it first:
  `test.use({ permissions: ["clipboard-read", "clipboard-write"] })`.

### Limits

A clean browser profile won't reproduce problems caused by the user's own
browser: extensions that change the page before React hydrates, or saved
state. While investigating a "Encountered a script tag" warning
(2026-10-09), a clean headless Chromium showed no warning on any route. The
suite catches what the app causes, not everything users can see. It also
only runs when someone runs it, or on a release tag in CI (see
[Deployment](deployment.md)).
