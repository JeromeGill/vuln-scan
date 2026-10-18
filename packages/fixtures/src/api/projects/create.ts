import type { CreateProject, ProjectDto } from "@repo/contracts";
import { projects } from "../../data/projects.js";
import type { ApiCase } from "../case.js";

const [storefront, adminDashboard] = projects;

/** `POST /projects`: each case creates a project of its own. */
export function createProjectCases(): ApiCase<CreateProject, ProjectDto>[] {
  return [
    {
      label: "S-0001 AC2: creates a project",
      request: { name: storefront.name },
      response: { name: storefront.name },
    },
    {
      label: "S-0001 AC2: trims the name",
      request: { name: `  ${adminDashboard.name}  ` },
      response: { name: adminDashboard.name },
    },
    {
      label: "S-0001 AC2: accepts a name of 100 characters",
      request: { name: "a".repeat(100) },
      response: { name: "a".repeat(100) },
    },
  ];
}
