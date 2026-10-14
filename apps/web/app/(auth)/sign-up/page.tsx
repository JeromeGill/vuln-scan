import { env } from "@repo/config/web";
import type { Metadata } from "next";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignUpPage() {
  return <SignUpForm googleSignIn={env.GOOGLE_SIGN_IN} />;
}
