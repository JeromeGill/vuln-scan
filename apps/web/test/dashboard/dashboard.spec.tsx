import { listProjectsCases } from "@repo/fixtures/api";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { Dashboard } from "@/containers/dashboard/dashboard";
import { formatDate } from "@/lib/format";
import { renderWithProviders } from "../render";
import { aProject, apiError, server, type ApiOutputs } from "../server";

// The create dialog navigates with Next's router, which only exists inside
// a running Next.js app.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn<(href: string) => void>() }),
}));

const [newestFirst] = listProjectsCases();

function listProjects(page: ApiOutputs["projects"]["list"]) {
  server.use(http.get("/api/projects", () => HttpResponse.json(page)));
}

describe("Dashboard", () => {
  it(`${newestFirst?.label} with their created dates`, async () => {
    const items = (newestFirst?.response.items ?? []).map((fields, index) =>
      aProject({
        ...fields,
        id: `00000000-0000-4000-8000-00000000010${index}`,
        createdAt: new Date(`2026-10-0${3 - index}T09:00:00Z`),
      }),
    );
    listProjects({ items, total: items.length });

    renderWithProviders(<Dashboard />);

    const table = await screen.findByRole("table");
    await within(table).findByRole("link", { name: items[0]?.name });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ),
    ).toEqual(
      items.map(({ name, createdAt }) => [name, formatDate(createdAt)]),
    );
    expect(
      within(table).getByRole("link", { name: items[0]?.name }),
    ).toHaveAttribute("href", `/projects/${items[0]?.id}`);
  });

  it("S-0001 AC1: shows an empty state that opens the create dialog", async () => {
    listProjects({ items: [], total: 0 });
    const user = userEvent.setup();

    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(
      await screen.findByRole("dialog", { name: "Create project" }),
    ).toBeInTheDocument();
  });

  it("pages through more projects than fit on a page", async () => {
    let offset: string | null = null;
    server.use(
      http.get("/api/projects", ({ request }) => {
        offset = new URL(request.url).searchParams.get("offset");
        return HttpResponse.json({
          items: [aProject({ name: `Project at ${offset}` })],
          total: 21,
        });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<Dashboard />);

    expect(await screen.findByText("Project at 0")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByText("Project at 20")).toBeInTheDocument();
    expect(offset).toBe("20");
  });

  it("says when the projects can't be loaded", async () => {
    server.use(
      http.get("/api/projects", () =>
        apiError({
          defined: false,
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Internal server error",
          data: undefined,
        }),
      ),
    );

    renderWithProviders(<Dashboard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load your projects.",
    );
  });
});
