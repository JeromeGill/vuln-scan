# One DataSource setup, only the api changes the schema

The worker reads and writes the same tables with the same entities, so the
TypeORM options (`postgresOptions`) and the dev schema sync
(`synchronizeSchema`) moved from `apps/api/src/database.ts` into
`@repo/entities`, rather than the worker importing from `apps/api`. Only the
api calls `synchronizeSchema`: two processes altering the schema could race,
and a worker built from an older branch would drop newer columns. The sync
takes a Postgres advisory lock because the api and worker integration
suites now set up the same test database in parallel.
