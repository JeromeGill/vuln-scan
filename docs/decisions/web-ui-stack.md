# Web UI stack

shadcn/ui on Tailwind v4 for components (copied into `apps/web`, not a
shared package, while there's one app; the Turborepo starter's unused
`@repo/ui` was removed), TanStack Table v9 for tables, TanStack
Form for forms, and TanStack Query via `@orpc/tanstack-query` for data. The
api client is generated from `@repo/contracts` with oRPC's `OpenAPILink`, so
the UI shares types and validation schemas with the api; forms validate with
the same zod schemas the api uses. Response dates use `z.coerce.date()` and
the client's `ResponseValidationPlugin`, because OpenAPI JSON carries dates
as strings. The api stays at its root and the web proxy maps `/api/*` onto
it, rather than prefixing every contract with `/api`.
