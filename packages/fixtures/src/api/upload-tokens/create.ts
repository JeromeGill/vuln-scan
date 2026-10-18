import type { CreatedUploadTokenDto, CreateUploadToken } from "@repo/contracts";
import { uploadTokens } from "../../data/upload-tokens.js";
import type { ApiCase } from "../case.js";

const [githubActions, releaseScript, stagingDeploys, ci] = uploadTokens;

/**
 * `POST /projects/{projectId}/upload-tokens`: each case creates a token of
 * its own. The spec checks what depends on the time and the random secret
 * (`token`, `lastFour`, `expiresAt` from `expiresInDays`).
 */
export function createUploadTokenCases(): ApiCase<
  CreateUploadToken,
  CreatedUploadTokenDto
>[] {
  return [
    {
      label: "S-0002 AC2: creates a token that never expires",
      request: { name: githubActions.name, expiresInDays: null },
      response: { name: githubActions.name, expiresAt: null, lastUsedAt: null },
    },
    {
      label: "S-0002 AC2: creates a token that expires in 30 days",
      request: { name: stagingDeploys.name, expiresInDays: 30 },
      response: { name: stagingDeploys.name, lastUsedAt: null },
    },
    {
      label: "S-0002 AC2: creates a token that expires in 90 days",
      request: { name: releaseScript.name, expiresInDays: 90 },
      response: { name: releaseScript.name, lastUsedAt: null },
    },
    {
      label: "S-0002 AC2: creates a token that expires in 365 days",
      request: { name: ci.name, expiresInDays: 365 },
      response: { name: ci.name, lastUsedAt: null },
    },
    {
      label: "S-0002 AC2: trims the name",
      request: { name: `  ${githubActions.name}  `, expiresInDays: null },
      response: { name: githubActions.name },
    },
    {
      label: "S-0002 AC2: accepts a name of 100 characters",
      request: { name: "a".repeat(100), expiresInDays: null },
      response: { name: "a".repeat(100) },
    },
  ];
}
