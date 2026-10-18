# @repo/fixtures

Sample data as plain objects, loaded into the dev database by the api's
seeder (`script/seed`), and, under the `@repo/fixtures/api` subpath,
request/response cases for the api's endpoints built from that data.

- **`@repo/fixtures`** (`src/data/`): the sample data, so far the fixture
  users (`users.ts`) and their shared password, projects (`projects.ts`,
  each in its `owner`'s personal organization), and upload tokens
  (`upload-tokens.ts`, each for a `project`, created by its owner), and
  sample lockfiles with the environments and versions CI deploys
  (`lockfiles.ts`). Add a file per kind of
  record, referring to other fixtures by natural keys (e.g. a user's
  `email`) and typed with `as const`.
- **`@repo/fixtures/api`** (`src/api/`): one file per endpoint that takes a
  body or query, in a folder per resource, named after the contract key
  (`widgets/create.ts` for `widgetsContract.create`), exporting a function
  that returns `ApiCase`s (`src/api/case.ts`): a label, a request, and the
  expected response without generated fields, typed with the contract's
  request and response types. So far `environments/` (list),
  `projects/` (create, list, rename),
  `upload-tokens/` (create, list), and `uploads/` (create; its multipart
  request holds the file's contents as a string, which the spec attaches).
  See [Testing](../../docs/testing.md#one-spec-per-endpoint).

- **Used by:** the api's seeder; the api integration tests and the browser
  tests (`apps/e2e`), for realistic values (their own helpers make them
  unique); the api's endpoint specs, which run the `@repo/fixtures/api`
  cases, and the web component tests, which send their requests from forms
  and mock the api with their responses.
- **Depends on:** `@repo/contracts`, type-only (`import type`), so the cases
  are checked against the contract's request and response types. No
  TypeORM or Better Auth: the seeder decides how to write the data. The
  fixture password is public, so fixture users are never loaded into a
  deployed environment.
