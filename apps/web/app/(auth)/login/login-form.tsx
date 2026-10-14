"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  checkInboxPath,
  signIn,
  VERIFY_EMAIL_CALLBACK,
} from "@/lib/auth-client";
import { GoogleButton, googleErrorMessage } from "../google-button";

export function LoginForm({
  googleSignIn,
  googleError,
}: {
  /** Shows "Continue with Google" (`GOOGLE_SIGN_IN`). */
  googleSignIn: boolean;
  /** The `error` a Google sign-in came back to this page with. */
  googleError: string | undefined;
}) {
  const [error, setError] = useState<string | null>(null);
  /** Set when the login was refused because this email isn't verified. */
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    setPending(true);
    setError(null);
    setUnverifiedEmail(null);
    // On success, Better Auth's client goes to callbackURL, which forwards
    // to /dashboard. When the email isn't verified yet, Better Auth refuses and
    // emails a new link, which leads there too.
    const { error: authError } = await signIn.email({
      email,
      password: String(form.get("password")),
      callbackURL: VERIFY_EMAIL_CALLBACK,
    });
    if (!authError) return;

    setPending(false);
    if (authError.code === "EMAIL_NOT_VERIFIED") {
      setUnverifiedEmail(email);
    } else {
      setError(authError.message ?? "Could not log in. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Log in to your account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {googleError && (
              <FieldError>{googleErrorMessage(googleError)}</FieldError>
            )}
            {googleSignIn && <GoogleButton />}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {error && <FieldError>{error}</FieldError>}
            {unverifiedEmail && (
              <FieldError>
                Verify your email first; we&apos;ve sent you a new link.{" "}
                <Link
                  href={checkInboxPath(unverifiedEmail)}
                  className="underline underline-offset-4"
                >
                  Didn&apos;t get it?
                </Link>
              </FieldError>
            )}
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Logging in…" : "Log in"}
              </Button>
              <FieldDescription className="text-center">
                No account yet? <Link href="/sign-up">Sign up</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
