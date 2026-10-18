import { accountContract } from "./account/contracts.js";
import { projectsContract } from "./projects/contracts.js";

export * from "./account/contracts.js";
export * from "./account/schemas.js";
export * from "./base.js";
export * from "./projects/contracts.js";
export * from "./projects/params.js";
export * from "./projects/schemas.js";

/** The whole API. The api implements it; clients are built from it. */
export const contract = {
  account: accountContract,
  projects: projectsContract,
};

export type Contract = typeof contract;
