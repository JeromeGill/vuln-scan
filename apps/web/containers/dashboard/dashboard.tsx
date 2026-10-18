"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/containers/projects/create-project-dialog";
import { ProjectsTable } from "@/containers/projects/projects-table";

/** The signed-in landing page: the user's projects. */
export function Dashboard() {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your projects, newest first."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New project
          </Button>
        }
      />
      <ProjectsTable onCreate={() => setCreating(true)} />
      <CreateProjectDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
