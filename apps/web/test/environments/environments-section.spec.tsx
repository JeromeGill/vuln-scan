import type { EnvironmentDto } from "@repo/contracts";
import { listEnvironmentsCases } from "@repo/fixtures/api";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { EnvironmentsSection } from "@/containers/environments/environments-section";
import { formatDateTime } from "@/lib/format";
import { renderWithProviders } from "../render";
import { anEnvironment, aProject, apiError, server } from "../server";

const project = aProject();
const environmentsPath = `/api/projects/${project.id}/environments`;
const [byName] = listEnvironmentsCases();

function listEnvironments(items: EnvironmentDto[]) {
  server.use(
    http.get(environmentsPath, () =>
      HttpResponse.json({ items, total: items.length }),
    ),
  );
}

/** The table's row for the environment named `name`. */
function rowOf(name: string) {
  const row = screen
    .getAllByRole("row")
    .find((candidate) => within(candidate).queryByText(name));
  if (!row) throw new Error(`No row for ${name}`);
  return row;
}

describe("Environments section", () => {
  it(`${byName?.label}, and when it was uploaded`, async () => {
    const items = (byName?.response.items ?? []).map((listed, index) =>
      anEnvironment({
        id: `00000000-0000-4000-8000-00000000030${index}`,
        name: listed.name,
        liveRelease: {
          version: listed.liveRelease.version,
          uploadedAt: new Date(`2026-10-1${index}T09:30:00Z`),
        },
      }),
    );
    const [first] = items;
    if (!first) throw new Error("expected environments to list");
    listEnvironments(items);

    renderWithProviders(<EnvironmentsSection projectId={project.id} />);

    await screen.findByText(first.name);
    const rows = screen.getAllByRole("row").slice(1);
    expect(
      rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent),
    ).toEqual(items.map(({ name }) => expect.stringContaining(name)));
    for (const { name, liveRelease } of items) {
      if (!liveRelease) continue;
      const row = rowOf(name);
      // Phones see both in the name cell, wider screens in their columns.
      expect(within(row).getAllByText(liveRelease.version)).toHaveLength(2);
      expect(
        within(row).getAllByText(formatDateTime(liveRelease.uploadedAt)),
      ).toHaveLength(2);
    }
  });

  it("asks the api for the next page", async () => {
    const offsets: (string | null)[] = [];
    server.use(
      http.get(environmentsPath, ({ request }) => {
        const offset = new URL(request.url).searchParams.get("offset");
        offsets.push(offset);
        const environment = anEnvironment({
          name: offset === "20" ? "staging" : "production",
        });
        return HttpResponse.json({ items: [environment], total: 21 });
      }),
    );
    const user = userEvent.setup();

    renderWithProviders(<EnvironmentsSection projectId={project.id} />);

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(await screen.findByText("staging")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(offsets).toEqual(["0", "20"]);
  });

  it("says when an environment has no live release yet", async () => {
    const environment = anEnvironment({ liveRelease: null });
    listEnvironments([environment]);

    renderWithProviders(<EnvironmentsSection projectId={project.id} />);

    await screen.findByText(environment.name);
    expect(
      within(rowOf(environment.name)).getAllByText("None yet"),
    ).not.toHaveLength(0);
  });

  it("shows an empty state until CI uploads", async () => {
    listEnvironments([]);

    renderWithProviders(<EnvironmentsSection projectId={project.id} />);

    expect(await screen.findByText("No environments yet")).toBeInTheDocument();
  });

  it("says when the environments can't be loaded", async () => {
    server.use(
      http.get(environmentsPath, () =>
        apiError({
          defined: false,
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Internal server error",
          data: undefined,
        }),
      ),
    );

    renderWithProviders(<EnvironmentsSection projectId={project.id} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load the environments.",
    );
  });
});
