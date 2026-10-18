import type { z } from "zod";
import { paginationParams } from "../base.js";

/**
 * Query of `GET /projects/{projectId}/environments`: a page of the
 * project's environments.
 */
export const listEnvironmentsParams = paginationParams;

export type ListEnvironmentsParams = z.infer<typeof listEnvironmentsParams>;
