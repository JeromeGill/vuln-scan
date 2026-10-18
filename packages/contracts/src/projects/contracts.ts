import { base, idParams, paginated } from "../base.js";
import { listProjectsParams } from "./params.js";
import {
  createProjectSchema,
  projectSchema,
  renameProjectSchema,
} from "./schemas.js";

export const projectsPath = "/projects";

/**
 * The projects of the signed-in user's organization (the session's active
 * one). Another organization's project is `NOT_FOUND`; a name already used
 * in the organization, ignoring case, is a `CONFLICT`.
 */
export const projectsContract = base
  .prefix(projectsPath)
  .tag("Projects")
  .router({
    /** Newest first. */
    list: base
      .route({ method: "GET", path: "/" })
      .input(listProjectsParams)
      .output(paginated(projectSchema)),
    create: base
      .route({ method: "POST", path: "/", successStatus: 201 })
      .input(createProjectSchema)
      .output(projectSchema),
    get: base
      .route({ method: "GET", path: "/{id}" })
      .input(idParams)
      .output(projectSchema),
    rename: base
      .route({ method: "PATCH", path: "/{id}" })
      .input(idParams.extend(renameProjectSchema.shape))
      .output(projectSchema),
    delete: base
      .route({ method: "DELETE", path: "/{id}", successStatus: 204 })
      .input(idParams),
  });
