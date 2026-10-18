import type { ORPCErrorJSON } from "@orpc/client";
import type { InferContractRouterOutputs } from "@orpc/contract";
import type {
  AccountDto,
  Contract,
  CreatedUploadTokenDto,
  ProjectDto,
  UploadTokenDto,
} from "@repo/contracts";
import { projects, uploadTokens, users } from "@repo/fixtures";
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

/**
 * An upload token as the api lists it: the first fixture token, created by
 * `anAccount()`, with `fields` on top.
 */
export function anUploadToken(
  fields: Partial<UploadTokenDto> = {},
): UploadTokenDto {
  const [{ name }] = uploadTokens;
  const { id: creatorId, name: creatorName } = anAccount();
  return {
    id: "00000000-0000-4000-8000-000000000201",
    name,
    lastFour: "Xy9_",
    createdBy: { id: creatorId, name: creatorName },
    createdAt: new Date("2026-10-02T09:00:00Z"),
    lastUsedAt: null,
    expiresAt: null,
    ...fields,
  };
}

/**
 * A new upload token as the api returns it once: `anUploadToken(fields)`
 * with its full `token`.
 */
export function aCreatedUploadToken(
  fields: Partial<CreatedUploadTokenDto> = {},
): CreatedUploadTokenDto {
  const token =
    fields.token ?? "vs_8kJ2mQ4nR6tV0wX3yZ5aB7cD9eF1gH3iJ5kL7mN9Xy9_";
  return {
    ...anUploadToken({ lastFour: token.slice(-4), ...fields }),
    token,
  };
}
