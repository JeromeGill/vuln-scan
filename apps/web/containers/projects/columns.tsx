import type { ProjectDto } from "@repo/contracts";
import { createColumnHelper, tableFeatures } from "@tanstack/react-table";
import Link from "next/link";
import { formatDate } from "@/lib/format";

/** The projects table uses no optional features: the api orders and pages it. */
export const projectFeatures = tableFeatures({});

const column = createColumnHelper<typeof projectFeatures, ProjectDto>();

export function projectColumns() {
  return column.columns([
    column.accessor("name", {
      header: "Name",
      cell: ({ row }) => (
        <Link
          href={`/projects/${row.original.id}`}
          // A long name without spaces still wraps on phones.
          className="font-medium wrap-anywhere hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    }),
    column.accessor("createdAt", {
      header: "Created",
      cell: ({ getValue }) => (
        <time
          dateTime={getValue().toISOString()}
          className="text-muted-foreground"
        >
          {formatDate(getValue())}
        </time>
      ),
    }),
  ]);
}
