import type {
  CreateProject,
  ListProjectsParams,
  Page,
  ProjectDto,
} from "@repo/contracts";
import { projects } from "../../data/projects.js";
import type { ApiCase } from "../case.js";

const [storefront, adminDashboard, marketingSite] = projects;

/** The projects every list case assumes, created in this order. */
export const listedProjects: CreateProject[] = [
  { name: storefront.name },
  { name: adminDashboard.name },
  { name: marketingSite.name },
];

/** `GET /projects` of the organization that has `listedProjects`. */
export function listProjectsCases(): ApiCase<
  Partial<ListProjectsParams>,
  Page<Partial<ProjectDto>>
>[] {
  return [
    {
      label: "S-0001 AC1: lists the organization's projects, newest first",
      request: {},
      response: {
        items: [
          { name: marketingSite.name },
          { name: adminDashboard.name },
          { name: storefront.name },
        ],
        total: 3,
      },
    },
    {
      label: "returns the page that limit and offset select",
      request: { limit: 1, offset: 1 },
      response: { items: [{ name: adminDashboard.name }], total: 3 },
    },
  ];
}
