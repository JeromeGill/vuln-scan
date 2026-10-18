"use client";

import type { EnvironmentDto } from "@repo/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { Layers } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DataTable,
  EmptyState,
  TablePagination,
} from "@/components/data-table";
import { orpc } from "@/lib/orpc";
import {
  environmentColumnClassNames,
  environmentColumns,
  environmentFeatures,
} from "./columns";

const PAGE_SIZE = 20;
const noEnvironments: EnvironmentDto[] = [];

/**
 * The project's environments in order of name, each with its live version
 * and when it was uploaded. Uploads from CI create them.
 */
export function EnvironmentsSection({ projectId }: { projectId: string }) {
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isPending, isError } = useQuery({
    ...orpc.environments.list.queryOptions({
      input: { projectId, limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE },
    }),
    placeholderData: keepPreviousData,
  });
  const columns = useMemo(() => environmentColumns(), []);
  const table = useTable({
    features: environmentFeatures,
    columns,
    data: data?.items ?? noEnvironments,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  return (
    <section aria-labelledby="environments-heading" className="space-y-4">
      <div className="space-y-1">
        <h2
          id="environments-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Environments
        </h2>
        <p className="text-sm text-muted-foreground">
          Where this project is deployed, and the version live in each.
        </p>
      </div>
      {isError ? (
        <p role="alert">Couldn&apos;t load the environments.</p>
      ) : (
        <>
          <DataTable
            table={table}
            isLoading={isPending}
            columnClassNames={environmentColumnClassNames}
            empty={
              <EmptyState
                icon={<Layers />}
                title="No environments yet"
                description="The first upload from CI to an environment adds it here. See Upload from CI below."
              />
            }
          />
          {pageCount > 1 && (
            <TablePagination
              pageIndex={pageIndex}
              pageCount={pageCount}
              total={total}
              noun={["environment", "environments"]}
              canPrevious={pageIndex > 0}
              canNext={pageIndex < pageCount - 1}
              onPrevious={() => setPageIndex((index) => index - 1)}
              onNext={() => setPageIndex((index) => index + 1)}
            />
          )}
        </>
      )}
    </section>
  );
}
