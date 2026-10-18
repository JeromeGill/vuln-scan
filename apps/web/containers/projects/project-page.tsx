"use client";

import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Pencil, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { orpc } from "@/lib/orpc";
import { EnvironmentsSection } from "@/containers/environments/environments-section";
import { UploadExample } from "@/containers/environments/upload-example";
import { UploadTokensSection } from "@/containers/upload-tokens/upload-tokens-section";
import { DeleteProjectDialog } from "./delete-project-dialog";
import { RenameProjectDialog } from "./rename-project-dialog";

/**
 * A project's page: its environments, its upload tokens and how CI uploads
 * with one, and renaming or deleting it.
 */
export function ProjectPage({ id }: { id: string }) {
  const { data: project, error } = useQuery(
    orpc.projects.get.queryOptions({ input: { id } }),
  );
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2.5" asChild>
        <Link href="/dashboard">
          <ChevronLeft />
          Dashboard
        </Link>
      </Button>
      {project ? (
        <>
          <PageHeader
            title={project.name}
            description={`Created ${formatDate(project.createdAt)}`}
            actions={
              <>
                <Button variant="outline" onClick={() => setRenaming(true)}>
                  <Pencil />
                  Rename
                </Button>
                <Button variant="destructive" onClick={() => setDeleting(true)}>
                  <Trash2 />
                  Delete
                </Button>
              </>
            }
          />
          <div className="space-y-10">
            <EnvironmentsSection projectId={project.id} />
            <UploadTokensSection projectId={project.id} />
            <UploadExample />
          </div>
          <RenameProjectDialog
            project={project}
            open={renaming}
            onOpenChange={setRenaming}
          />
          <DeleteProjectDialog
            project={project}
            open={deleting}
            onOpenChange={setDeleting}
          />
        </>
      ) : error ? (
        <ProjectError error={error} />
      ) : (
        <div className="mb-6 space-y-2">
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-5 w-40" />
        </div>
      )}
    </>
  );
}

function ProjectError({ error }: { error: unknown }) {
  // Another organization's project is NOT_FOUND too; an id that isn't a
  // uuid is a BAD_REQUEST, and just as missing.
  const missing =
    error instanceof ORPCError &&
    (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST");
  if (!missing) {
    return <p role="alert">Couldn&apos;t load the project.</p>;
  }
  return (
    <EmptyState
      icon={<SearchX />}
      title="Project not found"
      description="It may have been deleted, or the link is wrong."
      action={
        <Button variant="outline" asChild>
          <Link href="/dashboard">Back to your projects</Link>
        </Button>
      }
    />
  );
}
