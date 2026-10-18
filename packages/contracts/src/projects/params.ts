import { z } from "zod";
import { paginationParams } from "../base.js";

/** Query of `GET /projects`: a page of the organization's projects. */
export const listProjectsParams = paginationParams;

/**
 * `{projectId}` path parameter of the routes under a project
 * (`/projects/{projectId}/…`).
 */
export const projectIdParams = z.object({ projectId: z.uuid() });

export type ListProjectsParams = z.infer<typeof listProjectsParams>;
