"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
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

/** Creates a project, then opens its page. */
export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const create = useMutation(orpc.projects.create.mutationOptions());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            One for each app you deploy, named so you can tell them apart.
          </DialogDescription>
        </DialogHeader>
        <ProjectForm
          defaultValues={{ name: "" }}
          submitLabel="Create project"
          pendingLabel="Creating…"
          cancel={
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
          }
          onSubmit={async (value) => {
            const project = await create.mutateAsync(value);
            void queryClient.invalidateQueries({
              queryKey: orpc.projects.key(),
            });
            toast.success(`Created ${project.name}.`);
            onOpenChange(false);
            router.push(`/projects/${project.id}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
