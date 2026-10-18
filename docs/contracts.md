# API contracts

`@repo/contracts` (`packages/contracts/`) defines the api's routes
contract-first with [oRPC](https://orpc.dev/) (`@orpc/contract`) and
[zod](https://zod.dev/) 4. A contract is the route's method and path, its
validated input, its output, and its typed errors, with no implementation.
The api implements it (see [Implementing in the api](#implementing-in-the-api))
and clients can be generated from it, so both sides share one source of
truth.

## Layout

```
packages/contracts/src/
├── base.ts            base builder (shared errors) + shared params/helpers
├── index.ts           re-exports everything; `contract` = the whole API
├── account/
│   ├── schemas.ts     response shapes and POST/PATCH bodies
│   └── contracts.ts   the routes
├── projects/
│   ├── schemas.ts
│   ├── params.ts      GET query parameters (and `projectIdParams`)
│   └── contracts.ts
└── upload-tokens/     nested under a project: /projects/{projectId}/upload-tokens
    ├── schemas.ts
    ├── params.ts
    └── contracts.ts
```

A resource with GET query parameters adds a `params.ts` next to them.

The package only describes the api: routes, path and query params, request
bodies, responses, and errors, so the api and the web app share their types
and validation. Business logic doesn't go here, even when both sides use it;
framework-free rules shared by the api and worker belong in a package of
their own (no Nest, TypeORM, or zod).

- **`schemas.ts`**: the resource's response shape (`accountSchema`) and
  request bodies (e.g. `createWidgetSchema`, with `updateWidgetSchema` its
  `.partial()`), plus inferred types. Response types are suffixed `Dto`
  (`AccountDto`) so they don't clash with entity classes of the same name.
- **`params.ts`**: query parameters for fetches (`listWidgetsParams`). They
  arrive as strings, so numbers use `z.coerce`.
- **`contracts.ts`**: one router per resource, built from `base` with a path
  prefix and an OpenAPI tag, plus the prefix as a constant (`accountPath`)
  for the specs.
- **`base.ts`**: `base` declares the errors every route can return
  (`UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`; validation failures are oRPC's
  built-in `BAD_REQUEST`). Also `idParams`, `paginationParams` (`limit` 1–100,
  default 20; `offset`), `paginated(item)` (`{ items, total }`), and
  `isoDate`.

Contracts don't import `@repo/entities`: the schemas describe the HTTP shape,
which can differ from the table, and keeping TypeORM out lets browser code
import them.

## Routes

| Resource      | Routes                                                                                                                                                                                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| account       | `GET /account`: the signed-in user's id, name, and email                                                                                                                                                                                                                                                                       |
| projects      | `GET /projects` (paginated, newest first), `POST /projects`, `GET /projects/{id}`, `PATCH /projects/{id}` (rename), `DELETE /projects/{id}`: the active organization's projects ([S-0001](stories/0001-projects.md))                                                                                                           |
| upload-tokens | `GET /projects/{projectId}/upload-tokens` (paginated, newest first; revoked tokens left out), `POST /projects/{projectId}/upload-tokens` (the response is the only one with the full `token`), `DELETE /projects/{projectId}/upload-tokens/{id}` (revoke): a project's upload tokens ([S-0002](stories/0002-upload-tokens.md)) |

`account` is an example: it shows the whole path from the web app's client
through the proxy to an `@Implement`ed controller, and the browser tests
cover it through the dashboard page.

`projects` is the first owned resource: the controller takes the
organization from the session's `activeOrganizationId` (see
[Authentication](auth.md#organizations)) and the service scopes every query
to it, so another organization's project is `NOT_FOUND`. A name the
organization already uses, ignoring case and surrounding spaces, is a
`CONFLICT` (the database's unique constraint, mapped by
`isUniqueViolation` in `apps/api/src/database-errors.ts`).

`upload-tokens` is the first resource under a project: its routes take a
`projectId` path parameter (`projectIdParams`), the service first checks
the project is the organization's (`ProjectsService.get`, exported by
`ProjectsModule`), so another organization's project is `NOT_FOUND`
("Project not found."), and then scopes the tokens to the project. Token
generation and hashing live in the api (`src/upload-tokens/upload-token.ts`),
not in the contracts.

Inputs use oRPC's default **compact** structure: path parameters, query, and
body are merged into one input object (e.g. `PATCH /widgets/{id}` takes
`{ id, ...updateWidgetSchema }`). `POST` returns 201 and `DELETE` 204. A
`path: "/"` under a prefix becomes `/account/`, which oRPC matches as
`/account`.

## Implementing in the api

Each resource is a Nest module in `apps/api/src/<resource>/` with a
controller and (once it has logic) a service, registered
in `AppModule` next to `ORPCModule.forRoot(orpcConfig)` (`src/orpc.ts`).

- **Controller**: one method decorated `@Implement(<resource>Contract)`
  (from `@orpc/nest`) returns an object with a handler per route,
  `implement(contract).<route>.handler(({ input }) => …)`. `@Implement`
  registers the Nest routes (method, path, success status) from the contract,
  and oRPC's interceptor validates input and output and writes the response.
  Output validation strips fields the schema doesn't list (e.g. `userId`).
- **The method takes an unused `@Res() _res`.** Without it Nest sends a
  second reply after oRPC's, which throws `ERR_HTTP_HEADERS_SENT` on 204
  responses. See `src/orpc.ts` and [Troubleshooting](troubleshooting.md).
- **Auth**: the global Better Auth guard runs first, so every route needs a
  session (401 otherwise). Read the user with Nest's param decorator
  `@Session() session: UserSession` on the same method.
- **Public routes**: `@AllowAnonymous()` applies to the whole method, i.e.
  every route that `@Implement` registers. Put public routes in their own
  method, `@Implement`ing just that procedure (or sub-router).
- **Services** take the user id and the parsed input, use TypeORM
  repositories, and throw `ORPCError("NOT_FOUND" | "CONFLICT", { message })`
  from `@orpc/nest`. Another user's record is `NOT_FOUND`, not 403, so ids
  don't leak. Map unique and foreign-key violations to `CONFLICT`.
- `orpcConfig` logs errors that become 500s; expected errors aren't logged.

Error responses use oRPC's JSON shape, e.g.
`{ "defined": true, "code": "NOT_FOUND", "status": 404, "message": "Not found." }`;
validation failures are `BAD_REQUEST` with the zod issues in `data`.

Routes are mounted at the api root (`/account`, not `/api/account`). The web app
proxies `/api/*` to them and calls them through a typed client built from
these contracts; see [Web app](web.md#talking-to-the-api).

Note that the global auth guard runs before oRPC, so a request without a
session gets Nest's `{ "message": "Unauthorized", "statusCode": 401 }`, not
oRPC's error shape.

## Adding a resource

1. Create `src/<resource>/` with `schemas.ts`, `contracts.ts`, and
   `params.ts` if it has GET queries.
2. Build the router from `base`: `base.prefix("/<resource>").tag("<Name>").router({ … })`.
3. Re-export the files from `src/index.ts` and add the router to
   `contract`.
4. In the api, add `src/<resource>/` with a module, controller, and service
   following `projects/`, import the module in `AppModule`, and add one spec
   per route (see [Testing a new endpoint](testing.md#testing-a-new-endpoint)).
