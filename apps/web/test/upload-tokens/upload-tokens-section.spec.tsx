import type { UploadTokenDto } from "@repo/contracts";
import { listUploadTokensCases } from "@repo/fixtures/api";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { UploadTokensSection } from "@/containers/upload-tokens/upload-tokens-section";
import { formatDate } from "@/lib/format";
import { renderWithProviders } from "../render";
import {
  aCreatedUploadToken,
  anAccount,
  anUploadToken,
  aProject,
  apiError,
  server,
} from "../server";

const project = aProject();
const tokensPath = `/api/projects/${project.id}/upload-tokens`;
const [newestFirst] = listUploadTokensCases();
const day = 24 * 60 * 60 * 1000;

function listTokens(items: UploadTokenDto[]) {
  server.use(
    http.get(tokensPath, () =>
      HttpResponse.json({ items, total: items.length }),
    ),
  );
}

/** The table's row for the token named `name`. */
function rowOf(name: string) {
  const row = screen
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByText(name));
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe("Upload tokens section", () => {
  it(`${newestFirst?.label} with their details`, async () => {
    const lastUsedAt = new Date("2026-10-05T09:00:00Z");
    const expiresAt = new Date(Date.now() + 30 * day);
    const items = (newestFirst?.response.items ?? []).map((fields, index) =>
      anUploadToken({
        ...fields,
        id: `00000000-0000-4000-8000-00000000020${index}`,
        lastFour: `abc${index}`,
        createdAt: new Date(`2026-10-0${3 - index}T09:00:00Z`),
        // The newest has been used and expires; the oldest has neither.
        ...(index === 0 && { lastUsedAt, expiresAt }),
      }),
    );
    const [used] = items;
    const neverUsed = items.at(-1);
    if (!used || !neverUsed) throw new Error("expected tokens to list");
    listTokens(items);

    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await screen.findByText(used.name);
    const rows = screen.getAllByRole("row").slice(1);
    expect(
      rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent),
    ).toEqual(items.map(({ name }) => expect.stringContaining(name)));

    const usedRow = rowOf(used.name);
    expect(within(usedRow).getAllByText("vs_…abc0")).not.toHaveLength(0);
    expect(within(usedRow).getByText(anAccount().name)).toBeInTheDocument();
    for (const date of [used.createdAt, lastUsedAt, expiresAt]) {
      expect(within(usedRow).getByText(formatDate(date))).toBeInTheDocument();
    }

    const neverRow = rowOf(neverUsed.name);
    expect(within(neverRow).getByText("Never")).toBeInTheDocument();
    expect(within(neverRow).getByText("Never expires")).toBeInTheDocument();
  });

  it("S-0002 AC1: marks expired tokens as expired", async () => {
    const expired = anUploadToken({
      name: "Old CI",
      expiresAt: new Date(Date.now() - day),
    });
    const current = anUploadToken({
      id: "00000000-0000-4000-8000-000000000202",
      name: "New CI",
      expiresAt: new Date(Date.now() + day),
    });
    listTokens([current, expired]);

    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await screen.findByText(expired.name);
    expect(
      within(rowOf(expired.name)).getAllByText("Expired"),
    ).not.toHaveLength(0);
    expect(
      within(rowOf(current.name)).queryByText("Expired"),
    ).not.toBeInTheDocument();
  });

  it("names a creator whose account was deleted", async () => {
    const token = anUploadToken({ createdBy: null });
    listTokens([token]);

    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await screen.findByText(token.name);
    expect(
      within(rowOf(token.name)).getAllByText("a deleted user"),
    ).not.toHaveLength(0);
  });

  it("shows an empty state that opens the create dialog", async () => {
    listTokens([]);
    const user = userEvent.setup();

    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    expect(await screen.findByText("No tokens yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create token" }));
    expect(
      await screen.findByRole("dialog", { name: "Create token" }),
    ).toBeInTheDocument();
  });

  it("S-0002 AC2: adds the new token to the list", async () => {
    const created = aCreatedUploadToken();
    let tokens: UploadTokenDto[] = [];
    server.use(
      http.get(tokensPath, () =>
        HttpResponse.json({ items: tokens, total: tokens.length }),
      ),
      http.post(tokensPath, () => {
        tokens = [anUploadToken({ lastFour: created.lastFour })];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await user.click(await screen.findByRole("button", { name: "New token" }));
    const dialog = await screen.findByRole("dialog", { name: "Create token" });
    await user.type(within(dialog).getByLabelText("Name"), created.name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create token" }),
    );

    await within(dialog).findByLabelText("Token");
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(await screen.findByText(created.name)).toBeInTheDocument();
    expect(
      within(rowOf(created.name)).getAllByText(`vs_…${created.lastFour}`),
    ).not.toHaveLength(0);
  });

  it("S-0002 AC3: forgets the token once the dialog is closed", async () => {
    const created = aCreatedUploadToken();
    server.use(
      http.get(tokensPath, () => HttpResponse.json({ items: [], total: 0 })),
      http.post(tokensPath, () => HttpResponse.json(created, { status: 201 })),
    );
    const user = userEvent.setup();
    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await user.click(await screen.findByRole("button", { name: "New token" }));
    let dialog = await screen.findByRole("dialog", { name: "Create token" });
    await user.type(within(dialog).getByLabelText("Name"), created.name);
    await user.click(
      within(dialog).getByRole("button", { name: "Create token" }),
    );
    dialog = await screen.findByRole("dialog", { name: "Copy your token" });
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue(created.token)).not.toBeInTheDocument();

    // Opened again, it asks for a new token.
    await user.click(screen.getByRole("button", { name: "New token" }));
    dialog = await screen.findByRole("dialog", { name: "Create token" });
    expect(within(dialog).getByLabelText("Name")).toHaveValue("");
    expect(screen.queryByDisplayValue(created.token)).not.toBeInTheDocument();
  });

  it("S-0002 AC4: revokes a token after confirming", async () => {
    const token = anUploadToken();
    let revoked: string | null = null;
    server.use(
      http.get(tokensPath, () =>
        HttpResponse.json(
          revoked ? { items: [], total: 0 } : { items: [token], total: 1 },
        ),
      ),
      http.delete(`${tokensPath}/:id`, ({ params }) => {
        revoked = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await user.click(
      await screen.findByRole("button", { name: `Actions for ${token.name}` }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Revoke" }));
    const dialog = await screen.findByRole("alertdialog", {
      name: "Revoke token?",
    });
    expect(dialog).toHaveTextContent(token.name);
    await user.click(within(dialog).getByRole("button", { name: "Revoke" }));

    expect(await screen.findByText("No tokens yet")).toBeInTheDocument();
    expect(revoked).toBe(token.id);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(
      await screen.findByText(`Revoked ${token.name}.`),
    ).toBeInTheDocument();
  });

  it("S-0002 AC4: keeps the token when revoking is cancelled", async () => {
    const token = anUploadToken();
    let requests = 0;
    listTokens([token]);
    server.use(
      http.delete(`${tokensPath}/:id`, () => {
        requests += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    await user.click(
      await screen.findByRole("button", { name: `Actions for ${token.name}` }),
    );
    await user.click(await screen.findByRole("menuitem", { name: "Revoke" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText(token.name)).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("says when the tokens can't be loaded", async () => {
    server.use(
      http.get(tokensPath, () =>
        apiError({
          defined: false,
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Internal server error",
          data: undefined,
        }),
      ),
    );

    renderWithProviders(<UploadTokensSection projectId={project.id} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the tokens.",
    );
  });
});
