import { env } from "@repo/config/e2e";

/**
 * Where the browser tests run the app: their own ports, database, and
 * RabbitMQ vhost, so they never touch `script/server` (3000/3002) or the
 * development data.
 */
export const WEB_URL = "http://localhost:3100";
export const API_URL = "http://localhost:3102";
export const DB_NAME = "vulnscan_e2e_test";
export const VHOST = "vulnscan_e2e_test";

const rabbitmqUrl = new URL(env.RABBITMQ_URL);
rabbitmqUrl.pathname = `/${VHOST}`;

/** Overrides the repo-root `.env` for the api, worker, and web it starts. */
export const serverEnv = {
  PORT: new URL(API_URL).port,
  API_URL,
  // The web origin, as in production: verification links go through its proxy.
  BETTER_AUTH_URL: WEB_URL,
  WEB_URL,
  DB_NAME,
  RABBITMQ_URL: rabbitmqUrl.href,
  // Google sign-in on, with a client Google doesn't know: the Google test
  // stops at Google's page.
  GOOGLE_CLIENT_ID: "e2e-client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "e2e-client-secret",
  GOOGLE_SIGN_IN: "true",
  // The storage emulator (docker compose's fake-gcs), in a bucket of its own.
  STORAGE_DRIVER: "gcs",
  GCS_API_ENDPOINT: "http://localhost:4443",
  GCS_BUCKET: "vulnscan-e2e-test",
  // Its own build directory, so `next dev` can run next to script/server's.
  NEXT_DIST_DIR: ".next-e2e",
};

/** The session of the user most signed-in tests share (tests/auth.setup.ts). */
export const AUTH_FILE = ".auth/user.json";
