import { serverEnv, WEB_URL } from "../settings.ts";
import { expect, test } from "../fixtures.ts";

// Signed out. A real Google sign-in can't run here: the api tests cover what
// happens when Google comes back (apps/api/test/auth/google.integration.spec.ts).
test.use({ storageState: { cookies: [], origins: [] } });

test("Continue with Google goes to Google, to come back to the web origin", async ({
  page,
}) => {
  // Stand in for Google's page.
  await page.route("https://accounts.google.com/**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Google</title>" }),
  );
  await page.goto("/sign-up");

  const toGoogle = page.waitForRequest(/^https:\/\/accounts\.google\.com\//);
  await page.getByRole("button", { name: "Continue with Google" }).click();

  const url = new URL((await toGoogle).url());
  expect(url.pathname).toBe("/o/oauth2/v2/auth");
  expect(url.searchParams.get("client_id")).toBe(serverEnv.GOOGLE_CLIENT_ID);
  expect(url.searchParams.get("redirect_uri")).toBe(
    `${WEB_URL}/api/auth/callback/google`,
  );
});

test("the login page says to verify the existing account first", async ({
  page,
}) => {
  await page.goto("/login?error=account_not_linked");

  await expect(
    page.getByText(/Verify its email or log in with its password first/),
  ).toBeVisible();
});
