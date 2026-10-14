import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.integration.spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Suites share one database, vhost, and Mailpit, so run files serially.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
