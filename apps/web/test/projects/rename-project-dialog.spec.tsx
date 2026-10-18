import { projects } from "@repo/fixtures";
import { renameProjectCases } from "@repo/fixtures/api";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { RenameProjectDialog } from "@/containers/projects/rename-project-dialog";
import { renderWithProviders } from "../render";
import { aProject, apiError, server } from "../server";

const [, adminDashboard] = projects;

function renderDialog(project = aProject()) {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  renderWithProviders(
    <RenameProjectDialog project={project} open onOpenChange={onOpenChange} />,
  );
  return { onOpenChange, dialog: screen.getByRole("dialog") };
}

describe("Rename project", () => {
  it.each(renameProjectCases())(
    "$label",
    async ({ given, request, response }) => {
      const project = aProject(given);
      let sent: unknown;
      server.use(
        http.patch(`/api/projects/${project.id}`, async ({ request: req }) => {
          sent = await req.json();
          return HttpResponse.json(aProject({ ...project, ...response }));
        }),
      );
      const user = userEvent.setup();
      const { dialog, onOpenChange } = renderDialog(project);
      const name = within(dialog).getByLabelText("Name");

      expect(name).toHaveValue(project.name);
      await user.clear(name);
      await user.type(name, request.name);
      await user.click(within(dialog).getByRole("button", { name: "Rename" }));

      await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
      expect(sent).toEqual(request);
      expect(
        await screen.findByText(`Renamed the project to ${response.name}.`),
      ).toBeInTheDocument();
    },
  );

  it.each([
    {
      label: "S-0001 AC4: requires a name",
      name: "   ",
      error: "Enter a name.",
    },
    {
      label: "S-0001 AC4: rejects a name over 100 characters",
      name: "a".repeat(101),
      error: "Use at most 100 characters.",
    },
  ])("$label", async ({ name, error }) => {
    let requests = 0;
    server.use(
      http.patch("/api/projects/:id", () => {
        requests += 1;
        return HttpResponse.json(aProject());
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();
    const field = within(dialog).getByLabelText("Name");

    await user.clear(field);
    await user.type(field, name);
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(error);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(requests).toBe(0);
  });

  it("S-0001 AC4: shows a taken name on the name field", async () => {
    const project = aProject();
    server.use(
      http.patch(`/api/projects/${project.id}`, () =>
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
    const { dialog, onOpenChange } = renderDialog(project);
    const name = within(dialog).getByLabelText("Name");

    await user.clear(name);
    await user.type(name, adminDashboard.name);
    await user.click(within(dialog).getByRole("button", { name: "Rename" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "A project with this name already exists.",
    );
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
