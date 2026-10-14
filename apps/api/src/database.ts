import type { TypeOrmModuleAsyncOptions } from "@nestjs/typeorm";
import { env } from "@repo/config/api";
import { postgresOptions, synchronizeSchema } from "@repo/entities";
import { DataSource, type DataSourceOptions } from "typeorm";

// Auto-create tables outside production until migrations are set up. Only
// the api does this; the worker connects with the same options but never
// changes the schema.
const synchronize = env.NODE_ENV !== "production";

export function dataSourceOptions(): DataSourceOptions {
  return postgresOptions({
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
}

/**
 * Connects and, outside production, brings the schema up to date. Used by
 * `AppModule` and by standalone scripts such as the fixture seeder.
 */
export async function initializeDataSource(
  options: DataSourceOptions = dataSourceOptions(),
): Promise<DataSource> {
  const dataSource = await new DataSource(options).initialize();
  if (synchronize) await synchronizeSchema(dataSource);
  return dataSource;
}

export const databaseOptions: TypeOrmModuleAsyncOptions = {
  useFactory: dataSourceOptions,
  dataSourceFactory: initializeDataSource,
};
