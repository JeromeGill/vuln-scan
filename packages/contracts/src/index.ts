import { accountContract } from "./account/contracts.js";

export * from "./account/contracts.js";
export * from "./account/schemas.js";
export * from "./base.js";

/** The whole API. The api implements it; clients are built from it. */
export const contract = {
  account: accountContract,
};

export type Contract = typeof contract;
