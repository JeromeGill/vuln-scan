"use client";

import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { orpc } from "@/lib/orpc";

/**
 * The signed-in landing page. A placeholder: it loads the account through
 * the oRPC client, as feature pages will load their data.
 */
export function Dashboard() {
  const { data: account, isError } = useQuery(orpc.account.get.queryOptions());

  return (
    <>
      <PageHeader title="Dashboard" />
      {account ? (
        <p>
          Signed in as {account.name} ({account.email}).
        </p>
      ) : isError ? (
        <p role="alert">Couldn&apos;t load your account.</p>
      ) : (
        <Skeleton className="h-5 w-64" />
      )}
    </>
  );
}
