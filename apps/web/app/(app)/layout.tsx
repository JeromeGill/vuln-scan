import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSession } from "@/lib/session";

/** Signed-in area: redirects to /login without a session. */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={session.user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
