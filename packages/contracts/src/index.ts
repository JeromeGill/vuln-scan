import { accountContract } from "./account/contracts.js";
import { projectsContract } from "./projects/contracts.js";
import { uploadTokensContract } from "./upload-tokens/contracts.js";
import { uploadsContract } from "./uploads/contracts.js";

export * from "./account/contracts.js";
export * from "./account/schemas.js";
export * from "./base.js";
export * from "./projects/contracts.js";
export * from "./projects/params.js";
export * from "./projects/schemas.js";
export * from "./upload-tokens/contracts.js";
export * from "./upload-tokens/params.js";
export * from "./upload-tokens/schemas.js";
export * from "./uploads/contracts.js";
export * from "./uploads/schemas.js";

/** The whole API. The api implements it; clients are built from it. */
export const contract = {
  account: accountContract,
  projects: projectsContract,
  uploadTokens: uploadTokensContract,
  uploads: uploadsContract,
};

export type Contract = typeof contract;
