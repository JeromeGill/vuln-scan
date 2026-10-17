# Fixtures are data only; the api seeds them through Better Auth

`@repo/fixtures` holds plain data with no dependency on TypeORM or Better
Auth, so it could feed other consumers (tests, a web mock) later. The seeder
lives in the api because fixture users must be created through Better Auth
(`auth.api.signUpEmail`), which hashes passwords and writes the account rows;
only the api has the auth instance. It reuses the api's `DataSource` setup
(`initializeDataSource`) rather than booting Nest, and runs via
`nest start --entryFile seed` so the compiled ESM output is what runs.
