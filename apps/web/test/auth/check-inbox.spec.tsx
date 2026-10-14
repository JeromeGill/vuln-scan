import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { CheckInbox } from "@/app/(auth)/check-inbox/check-inbox";
import { renderWithProviders } from "../render";
import { server } from "../server";

describe("Check your inbox", () => {
  it("says where the link went", () => {
    renderWithProviders(<CheckInbox email="jo@example.com" />);

    expect(screen.getByText("Check your inbox")).toBeInTheDocument();
    expect(screen.getByText("jo@example.com")).toBeInTheDocument();
  });

  it("sends the link again", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/send-verification-email", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<CheckInbox email="jo@example.com" />);

    await user.click(screen.getByRole("button", { name: "Send it again" }));

    expect(await screen.findByText("Sent. Check your inbox.")).toBeVisible();
    expect(sent).toEqual({
      email: "jo@example.com",
      callbackURL: "/verify-email",
    });
  });

  it("has no button without an email to send to", () => {
    renderWithProviders(<CheckInbox email={undefined} />);

    expect(screen.getByText(/We've sent you a link\./)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
