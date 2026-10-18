import { base, paginated } from "../base.js";
import { projectsPath } from "../projects/contracts.js";
import { projectIdParams } from "../projects/params.js";
import { listEnvironmentsParams } from "./params.js";
import { environmentSchema } from "./schemas.js";

export const environmentsPath = `${projectsPath}/{projectId}/environments`;

/** `environmentsPath` for the project with id `projectId`. */
export function projectEnvironmentsPath(projectId: string): string {
  return environmentsPath.replace("{projectId}", projectId);
}

/**
 * The environments of one of the organization's projects, which uploads
 * create (`POST /uploads`). A project of another organization is
 * `NOT_FOUND`.
 */
export const environmentsContract = base
  .prefix(environmentsPath)
  .tag("Environments")
  .router({
    /** In order of name, each with its live release. */
    list: base
      .route({ method: "GET", path: "/" })
      .input(projectIdParams.extend(listEnvironmentsParams.shape))
      .output(paginated(environmentSchema)),
  });
