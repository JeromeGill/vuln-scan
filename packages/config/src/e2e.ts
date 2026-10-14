import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { databaseVars } from "./database.js";
import { env as sharedEnv } from "./shared.js";

/**
 * The browser tests (`apps/e2e`). They start the api, worker, and web
 * themselves, against their own database and RabbitMQ vhost; these are the
 * connection settings those are created with.
 */
export const env = createEnv({
  extends: [sharedEnv],
  server: {
    ...databaseVars,

    /** The broker; the tests use their own vhost on it. */
    RABBITMQ_URL: z.url().default("amqp://app:app@localhost:5672"),
    /**
     * `dev` runs the web app with `next dev`, which reports React's
     * hydration and rendering warnings; `prod` runs `next build` and
     * `next start`.
     */
    E2E_MODE: z.enum(["dev", "prod"]).default("dev"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
