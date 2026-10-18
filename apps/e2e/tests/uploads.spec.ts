import type { Page } from "@playwright/test";
import { deployments, lockfiles, projects, uploadTokens } from "@repo/fixtures";
import {
  createProject,
  createUploadToken,
  uniqueSuffix,
  uploadLockfile,
} from "../helpers/api.ts";
import { expectToFit } from "../helpers/layout.ts";
import { WEB_URL } from "../settings.ts";
import { expect, test } from "../fixtures.ts";

const [storefront] = projects;
const [githubActions] = uploadTokens;
const [production, staging] = deployments.environments;
const [v14, v15] = deployments.versions;
const [pnpmLock] = lockfiles;

/** A fixture name, made unique to this test. */
const uniqueName = (name: string) => `${name} ${uniqueSuffix()}`;

/** A date as the page shows it (the browser's locale is en-US). */
const shown = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);

/** A project of the signed-in user's with an upload token for it. */
async function projectWithToken(page: Page) {
  const project = await createProject(
    page.request,
    uniqueName(storefront.name),
  );
  // Expiring, so the only "Never" in its row is "never used".
  const token = await createUploadToken(
    page.request,
    project.id,
    uniqueName(githubActions.name),
    30,
  );
  return { project, token };
}

/** Uploads the pnpm lockfile to `environment` as `version`. */
async function upload(
  page: Page,
  token: string,
  environment: string,
  version: string,
) {
  await uploadLockfile(page.request, token, {
    environment,
    version,
    path: pnpmLock.path,
    file: pnpmLock.content,
  });
}

/** The Environments section's row for the environment named `name`. */
const environmentRow = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Environments" })
    .getByRole("row")
    .filter({ hasText: name });

test("S-0003 AC9: an upload updates the token's last used date", async ({
  page,
}) => {
  const { project, token } = await projectWithToken(page);
  await page.goto(`/projects/${project.id}`);
  const row = page
    .getByRole("region", { name: "Tokens" })
    .getByRole("row")
    .filter({ hasText: token.name });
  await expect(row).toContainText("Never");

  await upload(page, token.token, production, v14);
  await page.reload();

  await expect(row).toContainText(`Last used ${shown(new Date())}`);
  await expect(row).not.toContainText("Never");
});

test("S-0003 AC10: lists the environments with their live version and upload date", async ({
  page,
}) => {
  const { project, token } = await projectWithToken(page);
  await page.goto(`/projects/${project.id}`);
  await expect(page.getByText("No environments yet")).toBeVisible();

  await upload(page, token.token, staging, v14);
  await upload(page, token.token, production, v14);
  await upload(page, token.token, production, v15);
  await page.reload();

  const rows = page
    .getByRole("region", { name: "Environments" })
    .getByRole("row");
  // The header, then the environments by name.
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(1)).toContainText(production);
  await expect(rows.nth(2)).toContainText(staging);
  const today = shown(new Date());
  for (const [name, version] of [
    [production, v15],
    [staging, v14],
  ] as const) {
    const row = environmentRow(page, name);
    await expect(row).toContainText(version);
    await expect(row).toContainText(today);
  }
  await expect(environmentRow(page, production)).not.toContainText(v14);
});

test.describe("copying the upload command", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("S-0003 AC10: shows a ready-to-copy curl example for uploading", async ({
    page,
  }) => {
    const { project } = await projectWithToken(page);
    await page.goto(`/projects/${project.id}`);

    const example = page.getByRole("region", { name: "Upload from CI" });
    const command = example.getByText(/^curl /);
    await expect(command).toContainText(new URL("/api/uploads", WEB_URL).href);
    await expect(command).toContainText(
      "Authorization: Bearer $VULNSCAN_TOKEN",
    );
    await example.getByRole("button", { name: "Copy" }).click();
    await expect(example.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await command.textContent(),
    );
  });
});

test("S-0003 AC10: the Environments section and the upload example fit a 360 px screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const { project, token } = await projectWithToken(page);
  // The longest name and version there can be, without spaces.
  const name = `e${uniqueSuffix()}`.padEnd(64, "x");
  await upload(page, token.token, name, "v".repeat(128));
  await page.goto(`/projects/${project.id}`);

  await expect(environmentRow(page, name)).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Upload from CI" }).getByText(/^curl /),
  ).toBeVisible();
  await expectToFit(page);
});
