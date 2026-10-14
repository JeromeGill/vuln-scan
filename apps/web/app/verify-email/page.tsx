import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { VerifyEmailError } from "./verify-email-error";

export const metadata: Metadata = { title: "Verify your email" };

/**
 * Where Better Auth sends the browser after handling a verification link
 * (`/api/auth/verify-email`). Outside the `(app)` and `(auth)` groups,
 * whose layouts redirect.
 *
 * Without an error, the link verified the email and signed in, or it was
 * used already: either way, on to the dashboard, which send a signed-out visitor
 * to the login page. With `?error=` (expired or invalid link), it offers a
 * new link.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;
  if (typeof error !== "string") redirect("/dashboard");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Logo />
      <div className="w-full max-w-sm">
        <VerifyEmailError error={error} />
      </div>
    </main>
  );
}
