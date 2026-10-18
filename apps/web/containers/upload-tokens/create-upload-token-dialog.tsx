"use client";

import type { CreatedUploadTokenDto } from "@repo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc";
import { UploadTokenForm } from "./upload-token-form";

/**
 * Creates an upload token for the project, then shows the full token, the
 * only time it can be seen, with a copy button. Closing the dialog forgets
 * it.
 */
export function CreateUploadTokenDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const create = useMutation(orpc.uploadTokens.create.mutationOptions());
  const [created, setCreated] = useState<CreatedUploadTokenDto | null>(null);

  const changeOpen = (next: boolean) => {
    if (!next) setCreated(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        // Clicking outside by mistake would lose the token for good.
        onInteractOutside={(event) => {
          if (created) event.preventDefault();
        }}
      >
        {created ? (
          <CreatedToken token={created} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create token</DialogTitle>
              <DialogDescription>
                CI uploads this project&apos;s lockfiles with it. It can only
                upload to this project.
              </DialogDescription>
            </DialogHeader>
            <UploadTokenForm
              cancel={
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
              }
              onSubmit={async (value) => {
                const token = await create.mutateAsync({
                  projectId,
                  ...value,
                });
                void queryClient.invalidateQueries({
                  queryKey: orpc.uploadTokens.key(),
                });
                setCreated(token);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreatedToken({ token }: { token: CreatedUploadTokenDto }) {
  const id = useId();
  const [copied, setCopied] = useState(false);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Copy your token</DialogTitle>
        <DialogDescription>
          {token.name} can now upload this project&apos;s lockfiles.
        </DialogDescription>
      </DialogHeader>
      <p className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        Copy it now and keep it somewhere safe, like your CI&apos;s secrets. It
        won&apos;t be shown again.
      </p>
      <Field>
        <FieldLabel htmlFor={id}>Token</FieldLabel>
        <div className="flex gap-2">
          <Input
            id={id}
            readOnly
            value={token.token}
            className="min-w-0 font-mono text-xs"
            onFocus={(event) => event.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(token.token);
                setCopied(true);
                toast.success("Copied the token.");
              } catch {
                toast.error(
                  "Couldn't copy the token. Select it and copy it yourself.",
                );
              }
            }}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button">Done</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
