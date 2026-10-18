import type { Metadata } from "next";
import { ProjectPage } from "@/containers/projects/project-page";

export const metadata: Metadata = { title: "Project" };

export default async function Page({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  return <ProjectPage id={id} />;
}
