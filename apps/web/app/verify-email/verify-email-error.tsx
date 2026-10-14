"use client";

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
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  checkInboxPath,
  sendVerificationEmail,
  VERIFY_EMAIL_CALLBACK,
} from "@/lib/auth-client";

/**
 * A verification link that didn't work: Better Auth's `TOKEN_EXPIRED`
 * after an hour, `INVALID_TOKEN` (or anything else) otherwise. Asks for the
 * email to send a new one.
 */
export function VerifyEmailError({ error }: { error: string }) {
  const router = useRouter();
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email"));

    setPending(true);
    setSendError(null);
    const { error: authError } = await sendVerificationEmail({
      email,
      callbackURL: VERIFY_EMAIL_CALLBACK,
    });
    setPending(false);

    if (authError) {
      setSendError(
        authError.message ?? "Could not send the link. Please try again.",
      );
      return;
    }
    router.push(checkInboxPath(email));
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {error === "TOKEN_EXPIRED"
            ? "This link has expired"
            : "This link isn't valid"}
        </CardTitle>
        <CardDescription>
          Verification links work for an hour. Enter your email and we&apos;ll
          send you a new one.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
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
            {sendError && <FieldError>{sendError}</FieldError>}
            <Field>
              <Button type="submit" disabled={pending}>
                {pending ? "Sending…" : "Send a new link"}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
