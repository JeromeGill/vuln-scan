import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectPage } from "@/containers/projects/project-page";
import { formatDate } from "@/lib/format";
import { renderWithProviders } from "../render";
import {
  anEnvironment,
  anUploadToken,
  aProject,
  apiError,
  server,
} from "../server";

// Deleting goes back to the dashboard with Next's router, which only exists
// inside a running Next.js app. A stub that records where it was sent
// stands in for it.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => router.push.mockClear());

/**
 * Answers the project page's requests for `project`, with no environments
 * or tokens.
 */
function serveProject(project: ReturnType<typeof aProject>) {
  server.use(
    http.get(`/api/projects/${project.id}`, () => HttpResponse.json(project)),
    http.get(`/api/projects/${project.id}/environments`, () =>
      HttpResponse.json({ items: [], total: 0 }),
    ),
    http.get(`/api/projects/${project.id}/upload-tokens`, () =>
      HttpResponse.json({ items: [], total: 0 }),
    ),
  );
}

describe("Project page", () => {
  it("shows the project's name, when it was created, its environments, its tokens, and how to upload", async () => {
    const project = aProject();
    const environment = anEnvironment();
    const token = anUploadToken();
    server.use(
      http.get(`/api/projects/${project.id}`, () => HttpResponse.json(project)),
      http.get(`/api/projects/${project.id}/environments`, () =>
        HttpResponse.json({ items: [environment], total: 1 }),
      ),
      http.get(`/api/projects/${project.id}/upload-tokens`, () =>
        HttpResponse.json({ items: [token], total: 1 }),
      ),
    );

    renderWithProviders(<ProjectPage id={project.id} />);

    expect(
      await screen.findByRole("heading", { level: 1, name: project.name }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Created ${formatDate(project.createdAt)}`),
    ).toBeInTheDocument();
    for (const name of ["Environments", "Tokens", "Upload from CI"]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
    expect(await screen.findByText(environment.name)).toBeInTheDocument();
    expect(await screen.findByText(token.name)).toBeInTheDocument();
  });

  it.each([
    { code: "NOT_FOUND", status: 404, message: "Project not found." },
    // An id that isn't a uuid.
    { code: "BAD_REQUEST", status: 400, message: "Input validation failed" },
  ])("says a project is missing when the api answers $code", async (error) => {
    const { id } = aProject();
    server.use(
      http.get(`/api/projects/${id}`, () =>
        apiError({ defined: false, data: undefined, ...error }),
      ),
    );

    renderWithProviders(<ProjectPage id={id} />);

    expect(await screen.findByText("Project not found")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to your projects" }),
    ).toHaveAttribute("href", "/dashboard");
  });

  it("says when the project can't be loaded", async () => {
    const { id } = aProject();
    server.use(
      http.get(`/api/projects/${id}`, () =>
        apiError({
          defined: false,
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Internal server error",
          data: undefined,
        }),
      ),
    );

    renderWithProviders(<ProjectPage id={id} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the project.",
    );
  });

  it("S-0001 AC4: renames the project from its page", async () => {
    const project = aProject();
    const renamed = aProject({ name: "Admin dashboard" });
    serveProject(project);
    server.use(
      http.patch(`/api/projects/${project.id}`, () =>
        HttpResponse.json(renamed),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectPage id={project.id} />);

    await user.click(await screen.findByRole("button", { name: "Rename" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Rename project",
    });
    const name = within(dialog).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, renamed.name);
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: renamed.name }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("S-0001 AC5: deletes the project once its name is typed, then goes to the dashboard", async () => {
    const project = aProject();
    let deleted = false;
    serveProject(project);
    server.use(
      http.delete(`/api/projects/${project.id}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectPage id={project.id} />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete project?",
    });
    const confirm = within(dialog).getByRole("button", {
      name: "Delete project",
    });
    const field = within(dialog).getByLabelText(
      `Type ${project.name} to confirm`,
    );
    expect(confirm).toBeDisabled();
    await user.type(field, project.name.toLowerCase());
    expect(confirm).toBeDisabled();
    await user.clear(field);
    await user.type(field, project.name);
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await vi.waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/dashboard"),
    );
    expect(deleted).toBe(true);
    expect(
      await screen.findByText(`Deleted ${project.name}.`),
    ).toBeInTheDocument();
  });

  it("S-0001 AC5: forgets the typed name when the dialog is cancelled", async () => {
    const project = aProject();
    serveProject(project);
    const user = userEvent.setup();
    renderWithProviders(<ProjectPage id={project.id} />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    let dialog = await screen.findByRole("alertdialog");
    await user.type(
      within(dialog).getByLabelText(`Type ${project.name} to confirm`),
      project.name,
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByLabelText(`Type ${project.name} to confirm`),
    ).toHaveValue("");
    expect(
      within(dialog).getByRole("button", { name: "Delete project" }),
    ).toBeDisabled();
  });

  it("keeps the delete dialog open and says why when deleting fails", async () => {
    const project = aProject();
    serveProject(project);
    server.use(
      http.delete(`/api/projects/${project.id}`, () =>
        apiError({
          defined: false,
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Internal server error",
          data: undefined,
        }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ProjectPage id={project.id} />);

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(
      within(dialog).getByLabelText(`Type ${project.name} to confirm`),
      project.name,
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Delete project" }),
    );

    expect(
      await screen.findByText("Internal server error"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
