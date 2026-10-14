import { defineConfig, devices } from "@playwright/test";
import { env } from "@repo/config/e2e";
import { API_URL, AUTH_FILE, WEB_URL, serverEnv } from "./settings.ts";

const webPort = new URL(WEB_URL).port;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  // `next dev` compiles each page on its first visit.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
    {
      name: "phone",
      use: { ...devices["Pixel 7"], storageState: AUTH_FILE },
      dependencies: ["setup"],
    },
  ],
  // Started in this order, each once the previous one is ready. Never
  // reused: a server already on these ports is someone else's.
  webServer: [
    {
      name: "api",
      command: "node prepare.ts && node ../api/dist/main.js",
      url: `${API_URL}/api/auth/ok`,
      env: serverEnv,
      reuseExistingServer: false,
    },
    {
      name: "worker",
      command: "node ../worker/dist/main.js",
      // No HTTP server to poll.
      wait: { stdout: /Connected to RabbitMQ/ },
      env: serverEnv,
      reuseExistingServer: false,
    },
    {
      name: "web",
      command:
        env.E2E_MODE === "prod"
          ? `pnpm exec next build && pnpm exec next start --port ${webPort}`
          : `pnpm exec next dev --port ${webPort}`,
      cwd: "../web",
      url: `${WEB_URL}/login`,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
