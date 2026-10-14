import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { databaseVars } from "./database.js";
import { env as sharedEnv } from "./shared.js";

export const env = createEnv({
  extends: [sharedEnv],
  server: {
    ...databaseVars,

    /** AMQP URL; its path is the vhost (none means the default `/`). */
    RABBITMQ_URL: z.url().default("amqp://app:app@localhost:5672"),
    /**
     * Delay before each retry of a failed job, in milliseconds, comma
     * separated. A job that still fails after the last one is parked.
     */
    JOB_RETRY_DELAYS_MS: z
      .string()
      .default("10000,60000,300000")
      .transform((value, ctx) => {
        const delays = value.split(",").map((part) => Number(part.trim()));
        if (delays.some((delay) => !Number.isInteger(delay) || delay < 0)) {
          ctx.addIssue({
            code: "custom",
            message: "Expected comma-separated whole milliseconds.",
          });
          return z.NEVER;
        }
        return delays;
      }),

    /**
     * e.g. smtp://localhost:1025 (Mailpit) or smtps://user:pass@host:465,
     * with the user and password URL-encoded. No default, so a deployment
     * without it fails at startup instead of sending to localhost.
     */
    SMTP_URL: z.url({ protocol: /^smtps?$/ }),
    /**
     * From address of every email, `address@domain` or `Name <address@domain>`.
     * The provider only accepts its verified domains. No default, like
     * `SMTP_URL`.
     */
    MAIL_FROM: z
      .string()
      .trim()
      .refine(
        (value) =>
          z.email().safeParse(/<([^<>]+)>$/.exec(value)?.[1] ?? value).success,
        "Expected address@domain or Name <address@domain>.",
      ),
    /** Web app origin, for links in emails. */
    WEB_URL: z.url().default("http://localhost:3000"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
