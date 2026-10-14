import { type Page, test as setup } from "@playwright/test";
import { signUp } from "../helpers/api.ts";
import { AUTH_FILE } from "../settings.ts";

/**
 * Opens each page once so `next dev` compiles it before the tests run: the
 * first visit to a page compiles it, which on a slow CI runner can take longer
 * than a test waits for a navigation (a sign-up in v0.1.0-rc.2's run waited
 * 8.8 s for a signed-in page). Cheap in `E2E_MODE=prod`, where everything is built.
 */
async function warmUp(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
}

setup("sign up the shared user", async ({ page }) => {
  setup.setTimeout(180_000);

  await setup.step("compile the signed-out pages", () =>
    warmUp(page, [
      "/login",
      "/sign-up",
      "/check-inbox",
      "/verify-email?error=INVALID_TOKEN",
      "/offline",
    ]),
  );

  await signUp(page.request);
  await page.context().storageState({ path: AUTH_FILE });

  await setup.step("compile the signed-in pages", () =>
    warmUp(page, ["/dashboard"]),
  );
});
