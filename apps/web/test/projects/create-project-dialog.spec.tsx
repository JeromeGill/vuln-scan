import { createProjectCases } from "@repo/fixtures/api";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/containers/dashboard/dashboard";
import { CreateProjectDialog } from "@/containers/projects/create-project-dialog";
import { renderWithProviders } from "../render";
import { aProject, apiError, server } from "../server";

// The dialog opens the new project with Next's router, which only exists
// inside a running Next.js app. A stub that records where it was sent
// stands in for it.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => router.push.mockClear());

function renderDialog() {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  renderWithProviders(<CreateProjectDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange, dialog: screen.getByRole("dialog") };
}

describe("Create project", () => {
  it.each(createProjectCases())("$label", async ({ request, response }) => {
    const project = aProject(response);
    let sent: unknown;
    server.use(
      http.post("/api/projects", async ({ request: req }) => {
        sent = await req.json();
        return HttpResponse.json(project, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();

    await user.type(within(dialog).getByLabelText("Name"), request.name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    await vi.waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/projects/${project.id}`),
    );
    expect(sent).toEqual(request);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(
      await screen.findByText(`Created ${project.name}.`),
    ).toBeInTheDocument();
  });

  it("S-0001 AC2: adds the new project to the list", async () => {
    const project = aProject();
    let created = false;
    server.use(
      http.get("/api/projects", () =>
        HttpResponse.json(
          created ? { items: [project], total: 1 } : { items: [], total: 0 },
        ),
      ),
      http.post("/api/projects", () => {
        created = true;
        return HttpResponse.json(project, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<Dashboard />);

    await user.click(
      await screen.findByRole("button", { name: "New project" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), project.name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(
      await screen.findByRole("link", { name: project.name }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "S-0001 AC2: requires a name",
      name: "   ",
      error: "Enter a name.",
    },
    {
      label: "S-0001 AC2: rejects a name over 100 characters",
      name: "a".repeat(101),
      error: "Use at most 100 characters.",
    },
  ])("$label", async ({ name, error }) => {
    let requests = 0;
    server.use(
      http.post("/api/projects", () => {
        requests += 1;
        return HttpResponse.json(aProject(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await user.type(within(dialog).getByLabelText("Name"), name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(error);
    expect(within(dialog).getByLabelText("Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(requests).toBe(0);
  });

  it("S-0001 AC3: shows a taken name on the name field until it's changed", async () => {
    server.use(
      http.post("/api/projects", () =>
        apiError({
          defined: true,
          code: "CONFLICT",
          status: 409,
          message: "A project with this name already exists.",
          data: undefined,
        }),
      ),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();
    const name = within(dialog).getByLabelText("Name");

    await user.type(name, aProject().name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A project with this name already exists.",
    );
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    await user.type(name, " 2");
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "false");
  });

  it("shows other api errors in the form", async () => {
    server.use(
      http.post("/api/projects", () =>
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
    const { dialog } = renderDialog();

    await user.type(within(dialog).getByLabelText("Name"), aProject().name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Internal server error",
    );
    expect(within(dialog).getByLabelText("Name")).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });
});
