import type { CreateProject, ProjectDto, RenameProject } from "@repo/contracts";
import { projects } from "../../data/projects.js";
import type { ApiCase } from "../case.js";

const [storefront, adminDashboard] = projects;

/** A rename case, with the project it renames. */
export interface RenameProjectCase extends ApiCase<RenameProject, ProjectDto> {
  /** The project to create before renaming it. */
  given: CreateProject;
}

/** `PATCH /projects/{id}`. */
export function renameProjectCases(): RenameProjectCase[] {
  return [
    {
      label: "S-0001 AC4: renames a project",
      given: { name: storefront.name },
      request: { name: adminDashboard.name },
      response: { name: adminDashboard.name },
    },
    {
      label: "S-0001 AC4: trims the name",
      given: { name: storefront.name },
      request: { name: `  ${adminDashboard.name}  ` },
      response: { name: adminDashboard.name },
    },
    {
      label: "S-0001 AC4: changes only the case of its own name",
      given: { name: storefront.name },
      request: { name: storefront.name.toUpperCase() },
      response: { name: storefront.name.toUpperCase() },
    },
  ];
}
