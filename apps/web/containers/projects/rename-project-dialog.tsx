"use client";

import type { ProjectDto } from "@repo/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { orpc } from "@/lib/orpc";
import { ProjectForm } from "./project-form";

/** Renames the project, with the same rules as creating one. */
export function RenameProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const rename = useMutation(orpc.projects.rename.mutationOptions());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename project</DialogTitle>
          <DialogDescription>
            Its tokens and uploads stay as they are.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          defaultValues={{ name: project.name }}
          submitLabel="Rename"
          pendingLabel="Renaming…"
          cancel={
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
          }
          onSubmit={async (value) => {
            const renamed = await rename.mutateAsync({
              id: project.id,
              ...value,
            });
            queryClient.setQueryData(
              orpc.projects.get.queryKey({ input: { id: project.id } }),
              renamed,
            );
            void queryClient.invalidateQueries({
              queryKey: orpc.projects.list.key(),
            });
            toast.success(`Renamed the project to ${renamed.name}.`);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
