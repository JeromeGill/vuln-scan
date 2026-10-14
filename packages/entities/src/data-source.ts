import type { DataSource, DataSourceOptions } from "typeorm";
import { entities } from "./entities.js";

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

/**
 * TypeORM options for the app database with every entity registered. Never
 * synchronizes on connect: only the api brings the schema up to date (with
 * `synchronizeSchema`, outside production), so other processes such as the
 * worker can't race it or alter tables.
 */
export function postgresOptions(config: DatabaseConfig): DataSourceOptions {
  return {
    type: "postgres",
    ...config,
    entities,
    synchronize: false,
  };
}

// Arbitrary key for pg_advisory_lock, so concurrent processes (the api and
// test setups) don't run schema changes at the same time.
const SCHEMA_LOCK = 7_000_001;

/**
 * Creates every Postgres schema the entities use (TypeORM's synchronize
 * doesn't), then synchronizes tables to the entities, holding an advisory lock while doing
 * so. Development and tests only; production needs migrations.
 */
export async function synchronizeSchema(dataSource: DataSource): Promise<void> {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query("SELECT pg_advisory_lock($1)", [SCHEMA_LOCK]);
    const schemas = new Set(
      dataSource.entityMetadatas.flatMap(({ schema }) =>
        schema ? [schema] : [],
      ),
    );
    for (const schema of schemas) {
      await runner.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
    await dataSource.synchronize();
  } finally {
    await runner.query("SELECT pg_advisory_unlock($1)", [SCHEMA_LOCK]);
    await runner.release();
  }
}
