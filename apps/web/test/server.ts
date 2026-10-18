import type { ORPCErrorJSON } from "@orpc/client";
import type { InferContractRouterOutputs } from "@orpc/contract";
import type { AccountDto, Contract, ProjectDto } from "@repo/contracts";
import { projects, users } from "@repo/fixtures";
import { HttpResponse } from "msw";
import { setupServer } from "msw/node";

/**
 * Intercepts the app's fetches. Tests add handlers for the `/api/*` routes
 * they need with `server.use(http.get("/api/account", …))`.
 */
export const server = setupServer();

/** Response bodies by route, e.g. `ApiOutputs["account"]["get"]`. */
export type ApiOutputs = InferContractRouterOutputs<Contract>;

/** An error response as the api's oRPC handler sends it. */
export function apiError(json: ORPCErrorJSON<string, unknown>) {
  return HttpResponse.json(json, { status: json.status });
}

/**
 * The signed-in account as the api returns it: the first fixture user, with
 * `fields` on top.
 */
export function anAccount(fields: Partial<AccountDto> = {}): AccountDto {
  const [{ name, email }] = users;
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name,
    email,
    ...fields,
  };
}

/**
 * A project as the api returns it: the first fixture project, with `fields`
 * on top.
 */
export function aProject(fields: Partial<ProjectDto> = {}): ProjectDto {
  const [{ name }] = projects;
  return {
    id: "00000000-0000-4000-8000-000000000101",
    name,
    createdAt: new Date("2026-10-01T09:00:00Z"),
    updatedAt: new Date("2026-10-01T09:00:00Z"),
    ...fields,
  };
}
