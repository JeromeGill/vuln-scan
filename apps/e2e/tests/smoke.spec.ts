import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures.ts";

const signedOut = { cookies: [], origins: [] };

/** Where each route ends up, and the page or card title it shows. */
const routes = {
  signedOut: [
    { path: "/", url: "/login", title: "Welcome back" },
    { path: "/login", url: "/login", title: "Welcome back" },
    { path: "/sign-up", url: "/sign-up", title: "Create an account" },
    { path: "/dashboard", url: "/login", title: "Welcome back" },
  ],
  signedIn: [
    { path: "/", url: "/dashboard", title: "Dashboard" },
    { path: "/login", url: "/dashboard", title: "Dashboard" },
    { path: "/sign-up", url: "/dashboard", title: "Dashboard" },
    { path: "/dashboard", url: "/dashboard", title: "Dashboard" },
  ],
};

/**
 * Opens `path`, checks where it lands and its page or card title, and waits
 * for the page to settle so late console errors are caught too.
 */
async function visit(page: Page, path: string, url: string, title: string) {
  await page.goto(path);
  await expect(page).toHaveURL(url);
  await expect(
    page.locator("h1, [data-slot=card-title]", {
      hasText: new RegExp(`^${title}$`),
    }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
}

test.describe("signed out", () => {
  test.use({ storageState: signedOut });

  for (const { path, url, title } of routes.signedOut) {
    test(`${path} shows ${url}`, async ({ page }) => {
      await visit(page, path, url, title);
    });
  }
});

test.describe("signed in", () => {
  for (const { path, url, title } of routes.signedIn) {
    test(`${path} shows ${url}`, async ({ page }) => {
      await visit(page, path, url, title);
    });
  }
});

test("serves the web app manifest", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({
    name: "vulnscan",
    display: "standalone",
    start_url: "/",
  });
});
