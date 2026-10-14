import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Logo />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
