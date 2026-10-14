# @repo/contracts

Describes the api, and only the api: oRPC route contracts with their
params, request bodies, responses, and errors (zod), so the api and the web
app share types and validation.

- **Used by:** `apps/api` (implements the contracts) and `apps/web` (the
  client).
- **Depends on:** `@orpc/contract` and zod only.
- **Doesn't contain:** business logic, even when both sides need it (put it
  in a framework-free package of its own), or anything server-only (it's
  bundled into the browser).
