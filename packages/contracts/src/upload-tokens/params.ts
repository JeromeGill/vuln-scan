import type { z } from "zod";
import { paginationParams } from "../base.js";

/**
 * Query of `GET /projects/{projectId}/upload-tokens`: a page of the
 * project's tokens.
 */
export const listUploadTokensParams = paginationParams;

export type ListUploadTokensParams = z.infer<typeof listUploadTokensParams>;
