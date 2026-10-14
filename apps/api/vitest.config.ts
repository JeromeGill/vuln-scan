import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.spec.ts"],
    // Only integration specs so far (test/); unit specs go next to source.
    passWithNoTests: true,
  },
});
