import type { UploadTokenExpiry } from "@repo/contracts";
import type { projects } from "./projects.js";

type ProjectName = (typeof projects)[number]["name"];

/**
 * Upload tokens to create, each for the project named `project` (in its
 * owner's organization) and created by that owner. Their secrets are
 * random, so they can be listed but not used.
 */
export const uploadTokens = [
  { name: "GitHub Actions", project: "Storefront", expiresInDays: null },
  { name: "Release script", project: "Storefront", expiresInDays: 90 },
  { name: "Staging deploys", project: "Admin dashboard", expiresInDays: 30 },
  { name: "CI", project: "Mobile api", expiresInDays: 365 },
] as const satisfies readonly UploadTokenFixture[];

export interface UploadTokenFixture {
  name: string;
  project: ProjectName;
  /** Days until it expires; `null` never expires. */
  expiresInDays: UploadTokenExpiry;
}
