# In-repo TypeORM adapter for Better Auth

Better Auth has no official TypeORM adapter. The one published community
adapter had a single maintainer and supported only TypeORM 0.3. So
`apps/api/src/auth/typeorm-adapter.ts` implements Better Auth's adapter
interface (`createAdapterFactory`) on top of TypeORM repositories. It looks up
entities through an explicit model-key map rather than table names, so table
and schema naming stays in the entities.
