import { signUp } from "../helpers/api.ts";
import { expect, test } from "../fixtures.ts";

// Each test has its own user: signing out ends the session for everyone
// sharing it.
test.use({ storageState: { cookies: [], origins: [] } });

// Signing up is in email-verification.spec.ts: it goes through the emailed
// link.

test("logs in, after a wrong password shows an error", async ({
  page,
  request,
}) => {
  // `request` has its own cookies, so the page stays signed out.
  const { email, password } = await signUp(request);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Invalid email or password")).toBeVisible();
  await expect(page).toHaveURL("/login");

  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/dashboard");
});

test("logs out from the header", async ({ page }) => {
  await signUp(page.request);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "Account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");

  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");
});
