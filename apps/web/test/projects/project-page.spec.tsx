import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { ProjectPage } from "@/containers/projects/project-page";
import { formatDate } from "@/lib/format";
import { renderWithProviders } from "../render";
import { anUploadToken, aProject, apiError, server } from "../server";

describe("Project page", () => {
  it("shows the project's name, when it was created, and its tokens", async () => {
    const project = aProject();
    const token = anUploadToken();
    server.use(
      http.get(`/api/projects/${project.id}`, () => HttpResponse.json(project)),
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
    expect(
      screen.getByRole("heading", { level: 2, name: "Tokens" }),
    ).toBeInTheDocument();
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
});
