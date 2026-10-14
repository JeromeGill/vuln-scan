"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldSeparator } from "@/components/ui/field";
import { signIn } from "@/lib/auth-client";

/**
 * "Continue with Google". Better Auth's client sends the browser
 * to Google, which comes back to the dashboard, or to the login page with
 * `?error=` (see `googleErrorMessage`).
 */
export function GoogleButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    setError(null);
    const { error: authError } = await signIn.social({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/login",
    });
    if (!authError) return;

    setPending(false);
    setError(authError.message ?? "Could not reach Google. Please try again.");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={handleClick}
      >
        Continue with Google
      </Button>
      {error && <FieldError>{error}</FieldError>}
      <FieldSeparator>or</FieldSeparator>
    </>
  );
}

/** The login page's message for the `error` Google sign-in came back with. */
export function googleErrorMessage(error: string): string {
  return error === "account_not_linked"
    ? "There's already an account with this email that hasn't been verified. Verify its email or log in with its password first, then you can use Google too."
    : "Couldn't sign in with Google. Please try again.";
}
