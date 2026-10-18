import type { UploadTokenExpiry } from "@repo/contracts";
import { createUploadTokenCases } from "@repo/fixtures/api";
import { screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { CreateUploadTokenDialog } from "@/containers/upload-tokens/create-upload-token-dialog";
import { expiryOption } from "@/containers/upload-tokens/expiry";
import { renderWithProviders } from "../render";
import { aCreatedUploadToken, aProject, apiError, server } from "../server";

const project = aProject();
const tokensPath = `/api/projects/${project.id}/upload-tokens`;

function renderDialog() {
  const onOpenChange = vi.fn<(open: boolean) => void>();
  renderWithProviders(
    <CreateUploadTokenDialog
      projectId={project.id}
      open
      onOpenChange={onOpenChange}
    />,
  );
  return { onOpenChange, dialog: screen.getByRole("dialog") };
}

/** Fills in the form and submits it. */
async function submit(
  user: UserEvent,
  dialog: HTMLElement,
  name: string,
  expiresInDays: UploadTokenExpiry,
) {
  await user.type(within(dialog).getByLabelText("Name"), name);
  // Opened from the keyboard: in jsdom every pointer event is at (0, 0),
  // so Radix's Select takes clicking an option after a click on the field
  // for the same press and ignores it.
  await user.tab();
  expect(within(dialog).getByLabelText("Expires after")).toHaveFocus();
  await user.keyboard("{Enter}");
  await user.click(
    await screen.findByRole("option", {
      name: expiryOption(expiresInDays).label,
    }),
  );
  await user.click(
    within(dialog).getByRole("button", { name: "Create token" }),
  );
}

// Each test types into two fields and opens a Select: more than the default
// 5 s when script/test runs the browser suite alongside.
describe("Create upload token", { timeout: 15_000 }, () => {
  it.each(createUploadTokenCases())("$label", async ({ request, response }) => {
    const created = aCreatedUploadToken(response);
    let sent: unknown;
    server.use(
      http.post(tokensPath, async ({ request: req }) => {
        sent = await req.json();
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await submit(user, dialog, request.name, request.expiresInDays);

    expect(await within(dialog).findByLabelText("Token")).toHaveDisplayValue(
      created.token,
    );
    expect(sent).toEqual(request);
  });

  it("S-0002 AC2: shows the token once, with a copy button and a warning", async () => {
    const created = aCreatedUploadToken();
    server.use(
      http.post(tokensPath, () => HttpResponse.json(created, { status: 201 })),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();

    await submit(user, dialog, created.name, null);

    const token = await within(dialog).findByLabelText("Token");
    expect(token).toHaveDisplayValue(/^vs_/);
    expect(token).toHaveAttribute("readonly");
    expect(
      within(dialog).getByText(/It won't be shown again\./),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe(created.token);
    expect(
      within(dialog).getByRole("button", { name: "Copied" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Copied the token.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    {
      label: "S-0002 AC2: requires a name",
      name: "   ",
      error: "Enter a name.",
    },
    {
      label: "S-0002 AC2: rejects a name over 100 characters",
      name: "a".repeat(101),
      error: "Use at most 100 characters.",
    },
  ])("$label", async ({ name, error }) => {
    let requests = 0;
    server.use(
      http.post(tokensPath, () => {
        requests += 1;
        return HttpResponse.json(aCreatedUploadToken(), { status: 201 });
      }),
    );
    const user = userEvent.setup();
    const { dialog } = renderDialog();

    await submit(user, dialog, name, 90);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(error);
    expect(within(dialog).getByLabelText("Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(requests).toBe(0);
  });

  it("shows api errors in the form", async () => {
    server.use(
      http.post(tokensPath, () =>
        apiError({
          defined: true,
          code: "NOT_FOUND",
          status: 404,
          message: "Project not found.",
          data: undefined,
        }),
      ),
    );
    const user = userEvent.setup();
    const { dialog, onOpenChange } = renderDialog();

    await submit(user, dialog, "CI", 90);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Project not found.",
    );
    expect(within(dialog).queryByLabelText("Token")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
