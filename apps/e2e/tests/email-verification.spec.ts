import { fixturePassword, users } from "@repo/fixtures";
import { uniqueSuffix } from "../helpers/api.ts";
import { verificationLink } from "../helpers/mailpit.ts";
import { expect, test } from "../fixtures.ts";

// Every test starts signed out.
test.use({ storageState: { cookies: [], origins: [] } });

const newEmail = () => `e2e-${uniqueSuffix()}@example.com`;

test("signs up, opens the emailed link, and lands on the dashboard", async ({
  page,
}) => {
  const email = newEmail();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(users[0].name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await page.getByRole("button", { name: "Sign up" }).click();

  await expect(page).toHaveURL(
    `/check-inbox?${new URLSearchParams({ email })}`,
  );
  await expect(page.getByText("We've sent a link to")).toBeVisible();
  // Not signed in until the link is opened.
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/login");

  await page.goto(await verificationLink(email));
  await expect(page).toHaveURL("/dashboard");
  await expect(
    page.getByText(`Signed in as ${users[0].name} (${email}).`),
  ).toBeVisible();
});

test("logging in before verifying says to verify first", async ({
  page,
  request,
}) => {
  const email = newEmail();
  // `request` has its own cookies, so the page stays signed out.
  await request.post("/api/auth/sign-up/email", {
    data: { name: users[0].name, email, password: fixturePassword },
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(fixturePassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(
    page.getByText("Verify your email first; we've sent you a new link."),
  ).toBeVisible();
  await expect(page).toHaveURL("/login");

  await page.getByRole("link", { name: "Didn't get it?" }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole("button", { name: "Send it again" }).click();
  await expect(page.getByText("Sent. Check your inbox.")).toBeVisible();
});

test("a link that doesn't work offers a new one", async ({ page }) => {
  await page.goto(
    "/api/auth/verify-email?token=not-a-token&callbackURL=%2Fverify-email",
  );
  await expect(page.getByText("This link isn't valid")).toBeVisible();

  const email = newEmail();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send a new link" }).click();
  await expect(page).toHaveURL(
    `/check-inbox?${new URLSearchParams({ email })}`,
  );
});
