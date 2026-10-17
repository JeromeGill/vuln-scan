# One api spec per endpoint, with shared request and response cases

The api's integration tests are one spec per contract route, whose
successful requests are cases in `@repo/fixtures/api`, so it's obvious
which routes are covered and with what, and the web component tests send
and mock the same requests and responses (how to write one:
[Testing](../testing.md#testing-a-new-endpoint)). Grouping by resource was
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
