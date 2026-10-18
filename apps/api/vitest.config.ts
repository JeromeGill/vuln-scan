import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    // Unit specs live next to source; integration specs are in test/.
    include: ["src/**/*.spec.ts"],
  },
});
