"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
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
} from "@/components/ui/field";
import {
  sendVerificationEmail,
  VERIFY_EMAIL_CALLBACK,
} from "@/lib/auth-client";

/** After signing up, or a login refused until the email is verified. */
export function CheckInbox({ email }: { email: string | undefined }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendAgain(address: string) {
    setPending(true);
    setError(null);
    const { error: authError } = await sendVerificationEmail({
      email: address,
      callbackURL: VERIFY_EMAIL_CALLBACK,
    });
    setPending(false);

    if (authError) {
      setError(
        authError.message ?? "Could not send the link. Please try again.",
      );
      return;
    }
    toast.success("Sent. Check your inbox.");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Check your inbox</CardTitle>
        <CardDescription>
          {email ? (
            <>
              We&apos;ve sent a link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          ) : (
            "We've sent you a link."
          )}{" "}
          Open it to verify your email address and log in. It works for an hour.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {error && <FieldError>{error}</FieldError>}
          <Field>
            {email && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => sendAgain(email)}
              >
                {pending ? "Sending…" : "Send it again"}
              </Button>
            )}
            <FieldDescription className="text-center">
              Verified already? <Link href="/login">Log in</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
