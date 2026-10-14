import { screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/containers/dashboard/dashboard";
import { renderWithProviders } from "../render";
import { anAccount, apiError, server } from "../server";

describe("Dashboard", () => {
  it("shows who is signed in", async () => {
    const account = anAccount();
    server.use(http.get("/api/account", () => HttpResponse.json(account)));

    renderWithProviders(<Dashboard />);

    expect(
      await screen.findByText(
        `Signed in as ${account.name} (${account.email}).`,
      ),
    ).toBeInTheDocument();
  });

  it("says when the account can't be loaded", async () => {
    server.use(
      http.get("/api/account", () =>
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
      "Couldn't load your account.",
    );
  });
});
