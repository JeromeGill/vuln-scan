import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["test/**/*.integration.spec.ts"],
    globalSetup: ["test/global-setup.ts"],
  },
});
