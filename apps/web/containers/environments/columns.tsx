import type { EnvironmentDto } from "@repo/contracts";
import { createColumnHelper, tableFeatures } from "@tanstack/react-table";
import { formatDateTime } from "@/lib/format";

/** The environments table uses no optional features: the api orders and pages it. */
export const environmentFeatures = tableFeatures({});

const column = createColumnHelper<typeof environmentFeatures, EnvironmentDto>();

/**
 * Hidden columns by breakpoint: on phones their values are folded into the
 * name cell.
 */
export const environmentColumnClassNames = {
  version: "hidden sm:table-cell",
  uploadedAt: "hidden sm:table-cell",
};

type LiveRelease = NonNullable<EnvironmentDto["liveRelease"]>;

function Version({ release }: { release: LiveRelease | null }) {
  return release ? (
    // A commit SHA or a long version still wraps on phones.
    <code className="font-mono text-xs wrap-anywhere">{release.version}</code>
  ) : (
    <span className="text-muted-foreground">None yet</span>
  );
}

function UploadedAt({ release }: { release: LiveRelease | null }) {
  return release ? (
    <time dateTime={release.uploadedAt.toISOString()}>
      {formatDateTime(release.uploadedAt)}
    </time>
  ) : null;
}

export function environmentColumns() {
  return column.columns([
    column.accessor("name", {
      header: "Environment",
      cell: ({ row: { original: environment } }) => (
        <div className="space-y-1">
          <span className="font-medium wrap-anywhere">{environment.name}</span>
          <p className="space-x-1 text-xs text-muted-foreground sm:hidden">
            <Version release={environment.liveRelease} />
            {environment.liveRelease && (
              <>
                <span aria-hidden>·</span>
                <UploadedAt release={environment.liveRelease} />
              </>
            )}
          </p>
        </div>
      ),
    }),
    column.accessor("liveRelease", {
      id: "version",
      header: "Live version",
      cell: ({ getValue }) => <Version release={getValue()} />,
    }),
    column.accessor("liveRelease", {
      id: "uploadedAt",
      header: "Uploaded",
      cell: ({ getValue }) => <UploadedAt release={getValue()} />,
    }),
  ]);
}
