import type { Metadata } from "next";
import { CheckInbox } from "./check-inbox";

export const metadata: Metadata = {
  title: "Check your inbox",
};

export default async function CheckInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { email } = await searchParams;
  return <CheckInbox email={typeof email === "string" ? email : undefined} />;
}
