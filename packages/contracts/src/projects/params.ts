import type { z } from "zod";
import { paginationParams } from "../base.js";

/** Query of `GET /projects`: a page of the organization's projects. */
export const listProjectsParams = paginationParams;

export type ListProjectsParams = z.infer<typeof listProjectsParams>;
