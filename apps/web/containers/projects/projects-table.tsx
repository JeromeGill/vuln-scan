"use client";

import type { ProjectDto } from "@repo/contracts";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { FolderGit2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DataTable,
  EmptyState,
  TablePagination,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import { projectColumns, projectFeatures } from "./columns";

const PAGE_SIZE = 20;
const noProjects: ProjectDto[] = [];

/** The organization's projects, newest first, a page at a time. */
export function ProjectsTable({ onCreate }: { onCreate: () => void }) {
  const [pageIndex, setPageIndex] = useState(0);
  const { data, isPending, isError } = useQuery({
    ...orpc.projects.list.queryOptions({
      input: { limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE },
    }),
    placeholderData: keepPreviousData,
  });
  const columns = useMemo(() => projectColumns(), []);
  const table = useTable({
    features: projectFeatures,
    columns,
    data: data?.items ?? noProjects,
  });

  if (isError) {
    return <p role="alert">Couldn&apos;t load your projects.</p>;
  }

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  return (
    <>
      <DataTable
        table={table}
        isLoading={isPending}
        empty={
          <EmptyState
            icon={<FolderGit2 />}
            title="No projects yet"
            description="Create a project for each app you deploy."
            action={
              <Button onClick={onCreate}>
                <Plus />
                Create project
              </Button>
            }
          />
        }
      />
      {pageCount > 1 && (
        <TablePagination
          pageIndex={pageIndex}
          pageCount={pageCount}
          total={total}
          noun={["project", "projects"]}
          canPrevious={pageIndex > 0}
          canNext={pageIndex < pageCount - 1}
          onPrevious={() => setPageIndex((index) => index - 1)}
          onNext={() => setPageIndex((index) => index + 1)}
        />
      )}
    </>
  );
}
