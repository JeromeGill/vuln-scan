# Integration, not e2e, for the api and worker suites

The api's and worker's Supertest/Vitest suites boot one app against real
Postgres, RabbitMQ, and Mailpit, but no browser or web app is involved, so
they are integration tests. They were called "e2e" (`*.e2e-spec.ts`,
`test:e2e`) after the Nest starter's naming, and are now
`test/**/*.integration.spec.ts`, `vitest.config.integration.ts`, and
`test:integration`, which leaves "e2e" for the browser suite (`apps/e2e`,
[Testing](../testing.md#browser-tests)). The files keep a
`.spec.ts` ending so editors and tooling treat them as tests; the unit
configs only include `src/**/*.spec.ts`, so they never pick up the
integration files under `test/`.
