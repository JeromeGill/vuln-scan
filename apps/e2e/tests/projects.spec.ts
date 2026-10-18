import type { Page } from "@playwright/test";
import { projects } from "@repo/fixtures";
import { createProject, signUp, uniqueSuffix } from "../helpers/api.ts";
import { expect, test } from "../fixtures.ts";

const [storefront, adminDashboard] = projects;

/** A fixture project's name, made unique to this test. */
const uniqueName = (name: string) => `${name} ${uniqueSuffix()}`;

/** The dashboard's projects table. */
const projectsTable = (page: Page) =>
  page.getByRole("table").filter({ hasText: "Created" });

test.describe("a user of their own", () => {
  // These tests look at every project the user has.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("S-0001 AC1: shows an empty state with a Create project button", async ({
    page,
  }) => {
    await signUp(page.request);
    await page.goto("/dashboard");

    await expect(page.getByText("No projects yet")).toBeVisible();
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(
      page.getByRole("dialog", { name: "Create project" }),
    ).toBeVisible();
  });

  test("S-0001 AC1: lists the projects, newest first, with their created dates", async ({
    page,
  }) => {
    await signUp(page.request);
    const older = await createProject(page.request, storefront.name);
    const newer = await createProject(page.request, adminDashboard.name);
    await page.goto("/dashboard");

    const rows = projectsTable(page).getByRole("row");
    // The header, then the projects.
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toContainText(newer.name);
    await expect(rows.nth(2)).toContainText(older.name);
    const today = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
    }).format(new Date());
    await expect(rows.nth(1)).toContainText(today);
  });
});

test("S-0001 AC2: creates a project, opens its page, and lists it", async ({
  page,
}) => {
  const name = uniqueName(storefront.name);
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create project" });
  // Spaces around the name are trimmed.
  await dialog.getByLabel("Name").fill(`  ${name}  `);
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name, exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page).toHaveURL("/dashboard");
  await expect(
    projectsTable(page).getByRole("link", { name, exact: true }),
  ).toBeVisible();
});

test("S-0001 AC3: rejects a name already used, ignoring case, on the name field", async ({
  page,
}) => {
  const { name } = await createProject(
    page.request,
    uniqueName(adminDashboard.name),
  );
  await page.goto("/dashboard");

  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create project" });
  const field = dialog.getByLabel("Name");
  await field.fill(name.toUpperCase());
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "A project with this name already exists.",
  );
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(page).toHaveURL("/dashboard");
});

test("S-0001 AC7: the dashboard and the create dialog fit a 360 px screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  // 100 characters without a space, the longest name there can be.
  const suffix = uniqueSuffix();
  const { name } = await createProject(
    page.request,
    "a".repeat(100 - suffix.length) + suffix,
  );
  await page.goto("/dashboard");
  await expect(
    projectsTable(page).getByRole("link", { name, exact: true }),
  ).toBeVisible();
  await expectToFit(page);

  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "Create project" });
  await dialog.getByLabel("Name").fill(`${name}!`);
  await dialog.getByRole("button", { name: "Create project" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Use at most 100 characters.",
  );
  await expectToFit(page);
  const box = await dialog.boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 360).toBe(true);
});

/** Neither the page nor a table on it scrolls sideways. */
async function expectToFit(page: Page) {
  const overflowing = await page.evaluate(() =>
    [
      document.documentElement,
      ...document.querySelectorAll("[data-slot=table-container]"),
    ]
      .filter((element) => element.scrollWidth > element.clientWidth)
      .map((element) => element.tagName),
  );
  expect(overflowing).toEqual([]);
}
