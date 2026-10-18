import type { UserEmail } from "./users.js";

/**
 * Projects to create, each in the personal organization of the user whose
 * email is `owner`.
 */
export const projects = [
  { name: "Storefront", owner: "alice@example.com" },
  { name: "Admin dashboard", owner: "alice@example.com" },
  { name: "Marketing site", owner: "alice@example.com" },
  { name: "Mobile api", owner: "ben@example.com" },
] as const satisfies readonly ProjectFixture[];

export interface ProjectFixture {
  name: string;
  owner: UserEmail;
}
