"use client";

import type {
  Column_RowSorting,
  ReactTable,
  RowData,
  TableFeatures,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Renders any TanStack table with the shadcn table markup, a skeleton while
 * loading, and `empty` when there are no rows.
 */
export function DataTable<
  TFeatures extends TableFeatures,
  TData extends RowData,
  TSelected,
>({
  table,
  isLoading,
  empty,
  className,
  columnClassNames = {},
}: {
  table: ReactTable<TFeatures, TData, TSelected>;
  isLoading?: boolean;
  empty: ReactNode;
  className?: string;
  /** Extra classes for a column's header and cells, by column id (e.g. to hide it on small screens). */
  columnClassNames?: Record<string, string>;
}) {
  const columnCount = table.getAllLeafColumns().length;
  const rows = table.getRowModel().rows;

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <Table>
        <TableHeader className="bg-muted/40">
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    "h-10 px-3 sm:px-4",
                    columnClassNames[header.column.id],
                  )}
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }, (_row, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                {table.getAllLeafColumns().map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(
                      "px-3 py-3 sm:px-4",
                      columnClassNames[column.id],
                    )}
                  >
                    <Skeleton className="h-5 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      // Phones: wrap text so the table fits the screen.
                      "px-3 py-3 whitespace-normal sm:px-4 sm:whitespace-nowrap",
                      columnClassNames[cell.column.id],
                    )}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="p-0">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/** Column header button that cycles sorting. */
export function SortableHeader({
  title,
  sorted,
  onToggle,
  className,
}: {
  title: string;
  sorted: false | "asc" | "desc";
  onToggle: ((event: unknown) => void) | undefined;
  className?: string;
}) {
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("-ml-2.5 h-8 text-muted-foreground", className)}
      onClick={onToggle}
    >
      {title}
      <Icon className={cn("size-3.5", !sorted && "opacity-50")} />
    </Button>
  );
}

/**
 * A sort menu for narrow screens, where some sortable columns are hidden.
 * Choosing a column sorts by it in its first direction, like clicking its
 * header; choosing the current one flips it.
 */
export function SortMenu({
  columns,
  className,
}: {
  columns: {
    title: string;
    column: Pick<
      Column_RowSorting<TableFeatures, RowData>,
      "getIsSorted" | "getFirstSortDir" | "toggleSorting"
    >;
  }[];
  className?: string;
}) {
  const current = columns.find(({ column }) => column.getIsSorted());
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          <ArrowUpDown />
          {current ? `Sort: ${current.title}` : "Sort"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map(({ title, column }) => {
          const sorted = column.getIsSorted();
          const desc = sorted
            ? sorted === "asc"
            : column.getFirstSortDir() === "desc";
          const Icon = sorted === "desc" ? ArrowDown : ArrowUp;
          return (
            <DropdownMenuItem
              key={title}
              onSelect={() => column.toggleSorting(desc)}
            >
              {title}
              {sorted && <Icon className="ml-auto" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TablePagination({
  pageIndex,
  pageCount,
  total,
  noun,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  pageIndex: number;
  pageCount: number;
  total: number;
  noun: [singular: string, plural: string];
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-sm text-muted-foreground">
      <span>
        {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {pageCount ? pageIndex + 1 : 0} of {pageCount}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={!canPrevious}
          onClick={onPrevious}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={!canNext}
          onClick={onNext}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}
