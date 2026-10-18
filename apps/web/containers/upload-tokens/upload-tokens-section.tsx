"use client";

import type { UploadTokenDto } from "@repo/contracts";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  DataTable,
  EmptyState,
  TablePagination,
} from "@/components/data-table";
import { Button } from "@/components/ui/button";
import { orpc } from "@/lib/orpc";
import {
  uploadTokenColumnClassNames,
  uploadTokenColumns,
  uploadTokenFeatures,
} from "./columns";
import { CreateUploadTokenDialog } from "./create-upload-token-dialog";

const PAGE_SIZE = 20;
const noTokens: UploadTokenDto[] = [];

/**
 * The project's upload tokens, newest first, with the dialogs that create
 * and revoke them.
 */
export function UploadTokensSection({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<UploadTokenDto | null>(null);
  const { data, isPending, isError } = useQuery({
    ...orpc.uploadTokens.list.queryOptions({
      input: { projectId, limit: PAGE_SIZE, offset: pageIndex * PAGE_SIZE },
    }),
    placeholderData: keepPreviousData,
  });
  const revoke = useMutation(orpc.uploadTokens.revoke.mutationOptions());
  // Expiry is shown as of when the page was opened.
  const [now] = useState(() => new Date());
  const columns = useMemo(
    () => uploadTokenColumns({ now, onRevoke: setRevoking }),
    [now],
  );
  const table = useTable({
    features: uploadTokenFeatures,
    columns,
    data: data?.items ?? noTokens,
  });

  const total = data?.total ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);
  return (
    <section aria-labelledby="upload-tokens-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2
            id="upload-tokens-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Tokens
          </h2>
          <p className="text-sm text-muted-foreground">
            Your CI uploads this project&apos;s lockfiles with a token.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="self-start">
          <Plus />
          New token
        </Button>
      </div>
      {isError ? (
        <p role="alert">Couldn&apos;t load the tokens.</p>
      ) : (
        <>
          <DataTable
            table={table}
            isLoading={isPending}
            columnClassNames={uploadTokenColumnClassNames}
            empty={
              <EmptyState
                icon={<KeyRound />}
                title="No tokens yet"
                description="Create one for each CI pipeline that uploads lockfiles."
                action={
                  <Button variant="outline" onClick={() => setCreating(true)}>
                    <Plus />
                    Create token
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
              noun={["token", "tokens"]}
              canPrevious={pageIndex > 0}
              canNext={pageIndex < pageCount - 1}
              onPrevious={() => setPageIndex((index) => index - 1)}
              onNext={() => setPageIndex((index) => index + 1)}
            />
          )}
        </>
      )}
      <CreateUploadTokenDialog
        projectId={projectId}
        open={creating}
        onOpenChange={setCreating}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => {
          if (!open) setRevoking(null);
        }}
        title="Revoke token?"
        description={
          <>
            <span className="font-medium wrap-anywhere text-foreground">
              {revoking?.name}
            </span>{" "}
            stops working at once: uploads with it are refused. This can&apos;t
            be undone.
          </>
        }
        confirmLabel="Revoke"
        pendingLabel="Revoking…"
        onConfirm={async () => {
          if (!revoking) return;
          await revoke.mutateAsync({ projectId, id: revoking.id });
          void queryClient.invalidateQueries({
            queryKey: orpc.uploadTokens.key(),
          });
          toast.success(`Revoked ${revoking.name}.`);
        }}
      />
    </section>
  );
}
