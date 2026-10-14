# @repo/entities

The TypeORM entities (the database schema) and the DataSource options the
api and worker share (`postgresOptions`, `synchronizeSchema`).

- **Used by:** `apps/api` and `apps/worker`.
- **Depends on:** TypeORM only.
- **Doesn't contain:** queries or business logic; those live in the apps.
  Better Auth's entities are written only through Better Auth.
