import type { UploadTokenDto } from "@repo/contracts";
import { createColumnHelper, tableFeatures } from "@tanstack/react-table";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { describeExpiry, describeLastUsed, isExpired } from "./expiry";

/** The tokens table uses no optional features: the api orders and pages it. */
export const uploadTokenFeatures = tableFeatures({});

const column = createColumnHelper<typeof uploadTokenFeatures, UploadTokenDto>();

/**
 * Hidden columns by breakpoint: their values are folded into the name cell
 * where they're hidden, so phones still see every field.
 */
export const uploadTokenColumnClassNames = {
  lastFour: "hidden sm:table-cell",
  createdBy: "hidden lg:table-cell",
  createdAt: "hidden lg:table-cell",
  lastUsedAt: "hidden sm:table-cell",
  expiresAt: "hidden sm:table-cell",
  actions: "w-12",
};

function TokenEnding({ lastFour }: { lastFour: string }) {
  return <code className="font-mono text-xs">vs_…{lastFour}</code>;
}

function creatorName(token: UploadTokenDto): string {
  return token.createdBy?.name ?? "a deleted user";
}

export function uploadTokenColumns({
  now,
  onRevoke,
}: {
  /** What "expired" is measured against. */
  now: Date;
  onRevoke: (token: UploadTokenDto) => void;
}) {
  return column.columns([
    column.accessor("name", {
      header: "Name",
      cell: ({ row: { original: token } }) => (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* A long name without spaces still wraps on phones. */}
            <span className="font-medium wrap-anywhere">{token.name}</span>
            {isExpired(token, now) && (
              <Badge variant="destructive" className="sm:hidden">
                Expired
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground sm:hidden">
            <TokenEnding lastFour={token.lastFour} /> ·{" "}
            {describeExpiry(token, now)} · {describeLastUsed(token)}
          </p>
          <p className="text-xs text-muted-foreground lg:hidden">
            Created {formatDate(token.createdAt)} by {creatorName(token)}
          </p>
        </div>
      ),
    }),
    column.accessor("lastFour", {
      header: "Token",
      cell: ({ getValue }) => <TokenEnding lastFour={getValue()} />,
    }),
    column.accessor("createdBy", {
      header: "Created by",
      cell: ({ row }) => creatorName(row.original),
    }),
    column.accessor("createdAt", {
      header: "Created",
      cell: ({ getValue }) => (
        <time dateTime={getValue().toISOString()}>
          {formatDate(getValue())}
        </time>
      ),
    }),
    column.accessor("lastUsedAt", {
      header: "Last used",
      cell: ({ getValue }) => {
        const lastUsedAt = getValue();
        return lastUsedAt ? (
          <time dateTime={lastUsedAt.toISOString()}>
            {formatDate(lastUsedAt)}
          </time>
        ) : (
          <span className="text-muted-foreground">Never</span>
        );
      },
    }),
    column.accessor("expiresAt", {
      header: "Expires",
      cell: ({ row: { original: token } }) => {
        if (token.expiresAt === null) {
          return <span className="text-muted-foreground">Never expires</span>;
        }
        const date = (
          <time dateTime={token.expiresAt.toISOString()}>
            {formatDate(token.expiresAt)}
          </time>
        );
        return isExpired(token, now) ? (
          <span className="flex items-center gap-2">
            <Badge variant="destructive">Expired</Badge>
            {date}
          </span>
        ) : (
          date
        );
      },
    }),
    column.display({
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row: { original: token } }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${token.name}`}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onRevoke(token)}
            >
              <Trash2 />
              Revoke
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    }),
  ]);
}
