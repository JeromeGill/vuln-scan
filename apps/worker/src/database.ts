import type { TypeOrmModuleAsyncOptions } from "@nestjs/typeorm";
import { env } from "@repo/config/worker";
import { postgresOptions } from "@repo/entities";
import type { DataSourceOptions } from "typeorm";

/**
 * Same entities and connection settings as the api, but the worker never
 * creates schemas or synchronizes tables: the api owns the schema.
 */
export function dataSourceOptions(): DataSourceOptions {
  return postgresOptions({
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });
}

export const databaseOptions: TypeOrmModuleAsyncOptions = {
  useFactory: dataSourceOptions,
};
