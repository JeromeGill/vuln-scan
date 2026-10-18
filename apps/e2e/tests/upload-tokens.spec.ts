import type { Page } from "@playwright/test";
import { projects, uploadTokens, users } from "@repo/fixtures";
import {
  createProject,
  createUploadToken,
  uniqueSuffix,
} from "../helpers/api.ts";
import { expectToFit, expectWithin } from "../helpers/layout.ts";
import { expect, test } from "../fixtures.ts";

const [storefront] = projects;
const [githubActions, releaseScript] = uploadTokens;

/** A fixture name, made unique to this test. */
const uniqueName = (name: string) => `${name} ${uniqueSuffix()}`;

/** A date as the page shows it (the browser's locale is en-US). */
const shown = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);

/** Creates a project of the signed-in user's and opens its page. */
async function openNewProject(page: Page) {
  const project = await createProject(
    page.request,
    uniqueName(storefront.name),
  );
  await page.goto(`/projects/${project.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: project.name }),
  ).toBeVisible();
  return project;
}

/** The Tokens section's row for the token named `name`. */
const tokenRow = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Tokens" })
    .getByRole("row")
    .filter({ hasText: name });

/** Fills in and submits the create dialog, which then shows the token. */
async function createInDialog(page: Page, name: string, expiry: string) {
  await page.getByRole("button", { name: "New token" }).click();
  const dialog = page.getByRole("dialog", { name: "Create token" });
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("combobox", { name: "Expires after" }).click();
  await page.getByRole("option", { name: expiry }).click();
  await dialog.getByRole("button", { name: "Create token" }).click();
  const shownDialog = page.getByRole("dialog", { name: "Copy your token" });
  await expect(shownDialog.getByLabel("Token")).toHaveValue(/^vs_/);
  return shownDialog;
}

test("S-0002 AC1: lists the project's tokens with their details", async ({
  page,
}) => {
  const project = await createProject(
    page.request,
    uniqueName(storefront.name),
  );
  const forever = await createUploadToken(
    page.request,
    project.id,
    uniqueName(githubActions.name),
  );
  const monthly = await createUploadToken(
    page.request,
    project.id,
    uniqueName(releaseScript.name),
    30,
  );
  await page.goto(`/projects/${project.id}`);

  const today = shown(new Date());
  const foreverRow = tokenRow(page, forever.name);
  await expect(foreverRow).toBeVisible();
  for (const text of [
    `vs_…${forever.lastFour}`,
    users[0].name,
    today,
    "Never",
    "Never expires",
  ]) {
    await expect(foreverRow).toContainText(text);
  }
  const monthlyRow = tokenRow(page, monthly.name);
  await expect(monthlyRow).toContainText(`vs_…${monthly.lastFour}`);
  expect(monthly.expiresAt).not.toBeNull();
  if (monthly.expiresAt) {
    await expect(monthlyRow).toContainText(shown(monthly.expiresAt));
  }
  await expect(monthlyRow).not.toContainText("Expired");
  // Newest first.
  const names = await page
    .getByRole("region", { name: "Tokens" })
    .getByRole("row")
    .allTextContents();
  expect(names.findIndex((row) => row.includes(monthly.name))).toBeLessThan(
    names.findIndex((row) => row.includes(forever.name)),
  );
});

test.describe("copying the token", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("S-0002 AC2: creates a token and shows it once, with a copy button and a warning", async ({
    page,
  }) => {
    await openNewProject(page);
    const name = uniqueName(githubActions.name);

    const dialog = await createInDialog(page, name, "90 days");

    await expect(dialog).toContainText("It won't be shown again.");
    const token = await dialog.getByLabel("Token").inputValue();
    expect(token).toMatch(/^vs_[A-Za-z0-9_-]{43}$/);
    await dialog.getByRole("button", { name: "Copy" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      token,
    );

    await dialog.getByRole("button", { name: "Done" }).click();
    const row = tokenRow(page, name);
    await expect(row).toContainText(`vs_…${token.slice(-4)}`);
    await expect(row).toContainText(
      shown(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    );
  });
});

test("S-0002 AC3: once the dialog is closed, only the token's last four characters can be seen", async ({
  page,
}) => {
  const project = await openNewProject(page);
  const name = uniqueName(releaseScript.name);
  const dialog = await createInDialog(page, name, "Never");
  const token = await dialog.getByLabel("Token").inputValue();

  await dialog.getByRole("button", { name: "Done" }).click();

  await expect(dialog).toBeHidden();
  await expect(tokenRow(page, name)).toContainText(`vs_…${token.slice(-4)}`);
  expect(await page.content()).not.toContain(token);
  await page.reload();
  await expect(tokenRow(page, name)).toBeVisible();
  expect(await page.content()).not.toContain(token);
  const listed = await page.request.get(
    `/api/projects/${project.id}/upload-tokens`,
  );
  expect(listed.ok()).toBe(true);
  expect(await listed.text()).not.toContain(token);
});

test("S-0002 AC4: revokes a token after confirming", async ({ page }) => {
  const project = await createProject(
    page.request,
    uniqueName(storefront.name),
  );
  const kept = await createUploadToken(
    page.request,
    project.id,
    uniqueName(githubActions.name),
  );
  const revoked = await createUploadToken(
    page.request,
    project.id,
    uniqueName(releaseScript.name),
  );
  await page.goto(`/projects/${project.id}`);

  await page
    .getByRole("button", { name: `Actions for ${revoked.name}` })
    .click();
  await page.getByRole("menuitem", { name: "Revoke" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Revoke token?" });
  await expect(confirm).toContainText(revoked.name);
  await confirm.getByRole("button", { name: "Revoke" }).click();

  await expect(confirm).toBeHidden();
  await expect(page.getByText(`Revoked ${revoked.name}.`)).toBeVisible();
  await expect(tokenRow(page, revoked.name)).toHaveCount(0);
  await expect(tokenRow(page, kept.name)).toBeVisible();
  await page.reload();
  await expect(tokenRow(page, kept.name)).toBeVisible();
  await expect(tokenRow(page, revoked.name)).toHaveCount(0);
});

test("S-0002 AC6: the Tokens section and its dialogs fit a 360 px screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const project = await openNewProject(page);
  await expect(
    page
      .getByRole("region", { name: "Tokens" })
      .getByText("No tokens yet", { exact: true }),
  ).toBeVisible();
  await expectToFit(page);

  // 100 characters without a space, the longest name there can be.
  const suffix = uniqueSuffix();
  const long = await createUploadToken(
    page.request,
    project.id,
    "a".repeat(100 - suffix.length) + suffix,
    365,
  );
  await page.reload();
  await expect(tokenRow(page, long.name)).toBeVisible();
  await expectToFit(page);

  const dialog = await createInDialog(page, `b${long.name.slice(1)}`, "Never");
  await expectToFit(page);
  await expectWithin(dialog, 360);
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: `Actions for ${long.name}` }).click();
  await page.getByRole("menuitem", { name: "Revoke" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Revoke token?" });
  await expect(confirm).toBeVisible();
  await expectToFit(page);
  await expectWithin(confirm, 360);
});
