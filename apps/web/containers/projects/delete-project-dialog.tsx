"use client";

import type { ProjectDto } from "@repo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { orpc } from "@/lib/orpc";

/**
 * Deletes the project, with everything in it, once its name has been typed
 * to confirm; then goes back to the dashboard.
 */
export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const remove = useMutation(orpc.projects.delete.mutationOptions());
  const [typed, setTyped] = useState("");

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped("");
        onOpenChange(next);
      }}
      title="Delete project?"
      description={
        <>
          <span className="font-medium wrap-anywhere text-foreground">
            {project.name}
          </span>{" "}
          is deleted with its tokens, environments, releases, and stored
          lockfiles. This can&apos;t be undone.
        </>
      }
      confirmLabel="Delete project"
      confirmDisabled={typed.trim() !== project.name}
      onConfirm={async () => {
        await remove.mutateAsync({ id: project.id });
        // Only the list: refetching this project's page now would answer
        // NOT_FOUND before it's left.
        void queryClient.invalidateQueries({
          queryKey: orpc.projects.list.key(),
        });
        toast.success(`Deleted ${project.name}.`);
        router.push("/dashboard");
      }}
    >
      <Field>
        <FieldLabel htmlFor={id} className="block wrap-anywhere">
          Type <span className="font-semibold">{project.name}</span> to confirm
        </FieldLabel>
        <Input
          id={id}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
    </ConfirmDialog>
  );
}
