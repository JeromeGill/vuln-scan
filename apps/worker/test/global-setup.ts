import { Client } from "pg";
import { DataSource } from "typeorm";

/**
 * Prepares the test database and RabbitMQ vhost (from .env.test):
 * - creates DB_NAME if missing and brings its schema up to date (the worker
 *   never synchronizes, so in tests this stands in for the api),
 * - creates the vhost in RABBITMQ_URL through the management API.
 * Both names must end in `_test`, so tests never touch development data.
 */
export default async function setup() {
  // Vitest sets NODE_ENV=test in test workers; make sure the config loads
  // .env.test here too, before it's imported.
  process.env.NODE_ENV = "test";
  const { env } = await import("@repo/config/worker");
  const { postgresOptions, synchronizeSchema } = await import("@repo/entities");

  if (!env.DB_NAME.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against "${env.DB_NAME}": DB_NAME must end with "_test".`,
    );
  }
  const amqpUrl = new URL(env.RABBITMQ_URL);
  const vhost = decodeURIComponent(amqpUrl.pathname.slice(1));
  if (!vhost.endsWith("_test")) {
    throw new Error(
      `Refusing to run integration tests against RabbitMQ vhost "${vhost || "/"}": the RABBITMQ_URL path must end with "_test".`,
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
    if (!rowCount) await client.query(`CREATE DATABASE "${env.DB_NAME}"`);
  } finally {
    await client.end();
  }

  const dataSource = await new DataSource(
    postgresOptions({
      host: env.DB_HOST,
      port: env.DB_PORT,
      username: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
    }),
  ).initialize();
  try {
    await synchronizeSchema(dataSource);
  } finally {
    await dataSource.destroy();
  }

  // Management API on the broker's host (docker compose publishes 15672).
  const username = decodeURIComponent(amqpUrl.username);
  const password = decodeURIComponent(amqpUrl.password);
  const management = `http://${amqpUrl.hostname}:15672/api`;
  const headers = {
    authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
    "content-type": "application/json",
  };
  const name = encodeURIComponent(vhost);
  for (const [path, body] of [
    [`/vhosts/${name}`, {}],
    [
      `/permissions/${name}/${encodeURIComponent(username)}`,
      { configure: ".*", write: ".*", read: ".*" },
    ],
  ] as const) {
    const response = await fetch(`${management}${path}`, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(
        `RabbitMQ management API PUT ${path}: ${response.status} ${await response.text()}`,
      );
    }
  }
}
