import { createAuthClient } from "better-auth/react";

// No baseURL: requests go to this origin's /api/auth, which next.config.ts
// proxies to the api.
export const { signIn, signUp, signOut, sendVerificationEmail } =
  createAuthClient();

/**
 * Where the links in verification emails send the browser after Better
 * Auth has handled them (app/verify-email).
 */
export const VERIFY_EMAIL_CALLBACK = "/verify-email";

/** The page that says a verification link is on its way. */
export function checkInboxPath(email: string): string {
  return `/check-inbox?${new URLSearchParams({ email })}`;
}
