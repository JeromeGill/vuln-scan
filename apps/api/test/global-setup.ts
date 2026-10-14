import { Client } from "pg";

/**
 * Creates the test database (DB_NAME from .env.test) if it doesn't exist.
 * Tables are created by the api's schema sync when AppModule starts.
 */
export default async function setup() {
  // Vitest sets NODE_ENV=test in test workers; make sure the config loads
  // .env.test here too, before it's imported.
  process.env.NODE_ENV = "test";
  const { env } = await import("@repo/config/api");

  if (!env.DB_NAME.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${env.DB_NAME}": DB_NAME must end with "_test".`,
    );
  }

  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: "postgres",
  });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [env.DB_NAME],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${env.DB_NAME}"`);
    }
  } finally {
    await client.end();
  }
}
