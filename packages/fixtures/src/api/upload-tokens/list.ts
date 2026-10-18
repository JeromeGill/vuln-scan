import type {
  CreateUploadToken,
  ListUploadTokensParams,
  Page,
  UploadTokenDto,
} from "@repo/contracts";
import { uploadTokens } from "../../data/upload-tokens.js";
import type { ApiCase } from "../case.js";

const [githubActions, releaseScript, stagingDeploys] = uploadTokens;

/** The tokens every list case assumes, created in this order. */
export const listedUploadTokens: CreateUploadToken[] = [
  { name: githubActions.name, expiresInDays: githubActions.expiresInDays },
  { name: releaseScript.name, expiresInDays: releaseScript.expiresInDays },
  { name: stagingDeploys.name, expiresInDays: stagingDeploys.expiresInDays },
];

/** `GET /projects/{projectId}/upload-tokens` of a project with `listedUploadTokens`. */
export function listUploadTokensCases(): ApiCase<
  Partial<ListUploadTokensParams>,
  Page<Partial<UploadTokenDto>>
>[] {
  return [
    {
      label: "S-0002 AC1: lists the project's tokens, newest first",
      request: {},
      response: {
        items: [
          { name: stagingDeploys.name, lastUsedAt: null },
          { name: releaseScript.name, lastUsedAt: null },
          { name: githubActions.name, lastUsedAt: null, expiresAt: null },
        ],
        total: 3,
      },
    },
    {
      label: "returns the page that limit and offset select",
      request: { limit: 1, offset: 1 },
      response: { items: [{ name: releaseScript.name }], total: 3 },
    },
  ];
}
