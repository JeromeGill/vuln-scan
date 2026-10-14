import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.integration.spec.ts"],
    globalSetup: ["test/global-setup.ts"],
    // Suites share one database (and race on schema sync), so run files serially.
    fileParallelism: false,
    // Turns Google sign-in on; its endpoints are mocked
    // (test/auth/google.integration.spec.ts).
    env: {
      GOOGLE_CLIENT_ID: "test-client-id.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "test-client-secret",
    },
  },
});
