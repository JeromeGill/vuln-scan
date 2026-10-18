import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { databaseVars } from "./database.js";
import { env as sharedEnv } from "./shared.js";

export const env = createEnv({
  extends: [sharedEnv],
  server: {
    PORT: z.coerce.number().int().positive().default(3002),

    ...databaseVars,

    BETTER_AUTH_SECRET: z.string().min(32),
    /**
     * Where the browser reaches Better Auth: the web origin, whose
     * /api/auth proxy forwards to the api. Verification links are built
     * from it, so they and the session cookie go through the proxy.
     */
    BETTER_AUTH_URL: z.url().default("http://localhost:3000"),
    /** Web app origin, trusted by Better Auth. */
    WEB_URL: z.url().default("http://localhost:3000"),

    /**
     * AMQP URL for publishing jobs (verification emails); its path is the
     * vhost (none means the default `/`).
     */
    RABBITMQ_URL: z.url().default("amqp://vulnscan:vulnscan@localhost:5672"),

    /**
     * Google sign-in: the OAuth client's ID and secret, both or
     * neither. Unset, Google sign-in is off.
     */
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    /**
     * Object storage (docs/storage.md). Unset, the api runs without storage:
     * `StorageModule` provides no `ObjectStorage`.
     */
    STORAGE_DRIVER: z.enum(["gcs"]).optional(),
    /** The gcs driver's bucket; required when `STORAGE_DRIVER=gcs`. */
    GCS_BUCKET: z.string().optional(),
    /** An emulator instead of Google (`http://localhost:4443` locally). */
    GCS_API_ENDPOINT: z.url().optional(),
    /** Detected from the credentials when unset. */
    GCS_PROJECT_ID: z.string().optional(),
    /**
     * A service account key, as its JSON. Application Default Credentials
     * when unset; not used with `GCS_API_ENDPOINT`.
     */
    GCS_CREDENTIALS: z
      .string()
      .transform((value, ctx): unknown => {
        try {
          return JSON.parse(value);
        } catch {
          ctx.addIssue({ code: "custom", message: "Expected JSON." });
          return z.NEVER;
        }
      })
      .pipe(z.object({ client_email: z.string(), private_key: z.string() }))
      .optional(),
  },
  createFinalSchema: (shape) =>
    z
      .object(shape)
      .refine(
        (vars) => !vars.GOOGLE_CLIENT_ID === !vars.GOOGLE_CLIENT_SECRET,
        "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither.",
      ),
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
