"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  signUp,
  VERIFY_EMAIL_CALLBACK,
} from "@/lib/auth-client";
import { GoogleButton } from "../google-button";

// Better Auth's default minimum password length.
const MIN_PASSWORD_LENGTH = 8;

export function SignUpForm({
  googleSignIn,
}: {
  /** Shows "Continue with Google" (`GOOGLE_SIGN_IN`). */
  googleSignIn: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));

    setPending(true);
    setError(null);
    // Doesn't sign in: Better Auth emails a link that verifies the address
    // and signs in. An address that already has an account gets the same
    // answer (and no email), so the form doesn't reveal who has one.
    const { error: authError } = await signUp.email({
      name: String(form.get("name")),
      email,
      password: String(form.get("password")),
      callbackURL: VERIFY_EMAIL_CALLBACK,
    });
    setPending(false);

    if (authError) {
      setError(authError.message ?? "Could not sign up. Please try again.");
      return;
    }
    router.push(checkInboxPath(email));
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create an account</CardTitle>
        <CardDescription>Create your account to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {googleSignIn && <GoogleButton />}
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
              />
            </Field>
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
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                required
              />
              <FieldDescription>
                At least {MIN_PASSWORD_LENGTH} characters.
              </FieldDescription>
            </Field>
            {error && <FieldError>{error}</FieldError>}
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Creating account…" : "Sign up"}
              </Button>
              <FieldDescription className="text-center">
                Already have an account? <Link href="/login">Log in</Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
