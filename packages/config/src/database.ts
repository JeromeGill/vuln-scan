import { z } from "zod";

/** Postgres connection settings, shared by the api and worker schemas. */
export const databaseVars = {
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
};
