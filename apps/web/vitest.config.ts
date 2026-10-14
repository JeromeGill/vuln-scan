import { defineConfig } from "vitest/config";

export default defineConfig({
  // `@/` imports, from tsconfig.json's `paths`.
  resolve: { tsconfigPaths: true },
  // tsconfig.json says `jsx: preserve` (Next.js compiles JSX itself).
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "jsdom",
    // The page's origin, which the api clients call. A `.test` domain never
    // resolves, so a request MSW doesn't handle can't reach a running server.
    environmentOptions: { jsdom: { url: "http://app.test" } },
    include: ["test/**/*.spec.{ts,tsx}"],
    setupFiles: ["test/setup.ts"],
  },
});
