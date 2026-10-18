# e2e

Browser tests (Playwright): the real api, worker, and web app in Chromium,
on a desktop and a phone viewport. Each story with a UI has a test of its
main flow, and every test fails on a console error or warning. See
[`docs/testing.md`](../../docs/testing.md#browser-tests) to run, debug, and
add tests.

- **Starts its own servers** (`playwright.config.ts`): api on 3102, web on
  3100, and the worker, with their own database and RabbitMQ vhost
  (`vulnscan_e2e_test`, reset by `prepare.ts` on every run). It never
  reuses a running server, so it doesn't touch `script/server`. Storage is
  the `fake-gcs` emulator's `vulnscan-e2e-test` bucket.
- **Depends on:** the built api and worker (`dist/`), `@repo/config/e2e`,
  and `@repo/fixtures` for sample values. It talks to the app only as a
  browser or HTTP client would; no app code is imported.
- **Doesn't hold:** api or worker behaviour tests; those are the apps'
  integration suites.
