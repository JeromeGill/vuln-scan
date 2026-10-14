import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailError } from "@/app/verify-email/verify-email-error";
import { renderWithProviders } from "../render";
import { server } from "../server";

// The form navigates with Next's router, which only exists inside a running
// Next.js app. A stub that records where it was sent stands in for it.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => router.push.mockClear());

describe("Verification link error", () => {
  it("says an expired link has expired and sends a new one", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/send-verification-email", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ status: true });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<VerifyEmailError error="TOKEN_EXPIRED" />);

    expect(screen.getByText("This link has expired")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "jo@example.com");
    await user.click(screen.getByRole("button", { name: "Send a new link" }));

    await vi.waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        "/check-inbox?email=jo%40example.com",
      ),
    );
    expect(sent).toEqual({
      email: "jo@example.com",
      callbackURL: "/verify-email",
    });
  });

  it("says any other link isn't valid", () => {
    renderWithProviders(<VerifyEmailError error="INVALID_TOKEN" />);

    expect(screen.getByText("This link isn't valid")).toBeInTheDocument();
  });
});
