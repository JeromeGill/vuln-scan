import { z } from "zod";
import { base, paginated } from "../base.js";
import { projectsPath } from "../projects/contracts.js";
import { projectIdParams } from "../projects/params.js";
import { listUploadTokensParams } from "./params.js";
import {
  createdUploadTokenSchema,
  createUploadTokenSchema,
  uploadTokenSchema,
} from "./schemas.js";

export const uploadTokensPath = `${projectsPath}/{projectId}/upload-tokens`;

/** `uploadTokensPath` for the project with id `projectId`. */
export function projectUploadTokensPath(projectId: string): string {
  return uploadTokensPath.replace("{projectId}", projectId);
}

/**
 * The upload tokens of one of the organization's projects. A project of
 * another organization is `NOT_FOUND`, and so is a token of another project
 * or one already revoked.
 */
export const uploadTokensContract = base
  .prefix(uploadTokensPath)
  .tag("Upload tokens")
  .router({
    /** Tokens that aren't revoked, expired ones included; newest first. */
    list: base
      .route({ method: "GET", path: "/" })
      .input(projectIdParams.extend(listUploadTokensParams.shape))
      .output(paginated(uploadTokenSchema)),
    /** The response is the only time the full token is returned. */
    create: base
      .route({ method: "POST", path: "/", successStatus: 201 })
      .input(projectIdParams.extend(createUploadTokenSchema.shape))
      .output(createdUploadTokenSchema),
    /** The token stops working at once and leaves the list. */
    revoke: base
      .route({ method: "DELETE", path: "/{id}", successStatus: 204 })
      .input(projectIdParams.extend({ id: z.uuid() })),
  });
