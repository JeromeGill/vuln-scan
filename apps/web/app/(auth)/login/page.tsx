import { env } from "@repo/config/web";
import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  // Set when a Google sign-in comes back here (its errorCallbackURL).
  const { error } = await searchParams;
  return (
    <LoginForm
      googleSignIn={env.GOOGLE_SIGN_IN}
      googleError={typeof error === "string" ? error : undefined}
    />
  );
}
