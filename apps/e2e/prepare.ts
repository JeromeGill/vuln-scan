/**
 * Gives the browser tests an empty database and RabbitMQ vhost. Run before
 * the api starts (playwright.config.ts), since Playwright's `globalSetup`
 * only runs after its web servers are up. The api creates the tables.
 */
import { env } from "@repo/config/e2e";
import { Client } from "pg";
import { DB_NAME, VHOST } from "./settings.ts";

for (const name of [DB_NAME, VHOST]) {
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to reset "${name}": its name must end in "_test".`,
    );
  }
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
  // Identifiers can't be query parameters; DB_NAME is a constant above.
  await client.query(`DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${DB_NAME}"`);
} finally {
  await client.end();
}

// The management API on the broker's host (docker compose publishes 15672).
const amqpUrl = new URL(env.RABBITMQ_URL);
const username = decodeURIComponent(amqpUrl.username);
const password = decodeURIComponent(amqpUrl.password);
const vhostUrl = `http://${amqpUrl.hostname}:15672/api/vhosts/${VHOST}`;
const headers = {
  authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
  "content-type": "application/json",
};
const deleted = await fetch(vhostUrl, { method: "DELETE", headers });
if (!deleted.ok && deleted.status !== 404) {
  throw new Error(`Deleting the RabbitMQ vhost: ${deleted.status}`);
}
for (const [url, body] of [
  [vhostUrl, {}],
  [
    `http://${amqpUrl.hostname}:15672/api/permissions/${VHOST}/${encodeURIComponent(username)}`,
    { configure: ".*", write: ".*", read: ".*" },
  ],
] as const) {
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`RabbitMQ management API PUT ${url}: ${response.status}`);
  }
}
