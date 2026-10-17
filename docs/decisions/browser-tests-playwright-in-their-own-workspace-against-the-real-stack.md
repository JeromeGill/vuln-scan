# Browser tests: Playwright in their own workspace, against the real stack

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
