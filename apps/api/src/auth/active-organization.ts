import type { UserSession } from "@thallesp/nestjs-better-auth";

/**
 * The organization the session works in. Every session gets one when it's
 * created (see docs/auth.md#organizations), so a session without one is a
 * bug, not a client error.
 */
export function activeOrganizationId(session: UserSession): string {
  const id = session.session.activeOrganizationId;
  if (!id) throw new Error("The session has no active organization.");
  return id;
}
