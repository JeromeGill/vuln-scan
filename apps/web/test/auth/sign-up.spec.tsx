import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { users } from "@repo/fixtures";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";
import { renderWithProviders } from "../render";
import { server } from "../server";

// The form navigates with Next's router, which only exists inside a running
// Next.js app. A stub that records where it was sent stands in for it.
const router = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => router.push.mockClear());

describe("Sign up", () => {
  it("signs up and goes to the check-inbox page", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/sign-up/email", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ token: null, user: {} });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SignUpForm googleSignIn={false} />);

    await user.type(screen.getByLabelText("Name"), users[0].name);
    await user.type(screen.getByLabelText("Email"), "jo@example.com");
    await user.type(screen.getByLabelText("Password"), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await vi.waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        "/check-inbox?email=jo%40example.com",
      ),
    );
    expect(sent).toEqual({
      name: users[0].name,
      email: "jo@example.com",
      password: "correct horse",
      callbackURL: "/verify-email",
    });
  });
});
