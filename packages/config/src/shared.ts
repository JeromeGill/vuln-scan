import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseEnv } from "node:util";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * The monorepo root: the nearest directory at or above the working directory
 * that holds `pnpm-workspace.yaml`. Found from the working directory rather
 * than this file's location because bundlers (Next.js) move this code into
 * their own output, where `import.meta.url` no longer points into the repo.
 */
// The `turbopackIgnore` comments stop Next.js from tracing the whole repo into
// its build output because of these dynamic reads; the .env files are a
// local-development convenience, not something to deploy.
function findRepoRoot(): string | undefined {
  let dir = process.cwd();
  while (
    !existsSync(/*turbopackIgnore: true*/ join(dir, "pnpm-workspace.yaml"))
  ) {
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
  return dir;
}

/**
 * Loads the repo-root `.env` into process.env. When NODE_ENV is "test",
 * `.env.test` is loaded first, so it only needs the values that differ.
 * Precedence: environment > `.env.test` > `.env` (a set variable is never
 * overwritten).
 */
function loadEnvFiles() {
  const root = findRepoRoot();
  if (!root) return;
  const files =
    process.env.NODE_ENV === "test" ? [".env.test", ".env"] : [".env"];

  for (const file of files) {
    const path = join(/*turbopackIgnore: true*/ root, file);
    if (!existsSync(/*turbopackIgnore: true*/ path)) continue;

    for (const [key, value] of Object.entries(
      parseEnv(readFileSync(/*turbopackIgnore: true*/ path, "utf8")),
    )) {
      process.env[key] ??= value;
    }
  }
}

loadEnvFiles();

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
