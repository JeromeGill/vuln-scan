import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { renderWithProviders } from "../render";
import { server } from "../server";

async function logIn(email: string, password: string) {
  const user = userEvent.setup();
  renderWithProviders(
    <LoginForm googleSignIn={false} googleError={undefined} />,
  );
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Log in" }));
}

describe("Login", () => {
  // Better Auth's client then goes to the callback (/verify-email, which
  // forwards to /dashboard); the browser tests follow that.
  it("logs in with /verify-email as the callback", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/sign-in/email", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ redirect: false, token: "token" });
      }),
    );

    await logIn("jo@example.com", "correct horse");

    await vi.waitFor(() =>
      expect(sent).toEqual({
        email: "jo@example.com",
        password: "correct horse",
        callbackURL: "/verify-email",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows Better Auth's error and stays on the page", async () => {
    server.use(
      http.post("/api/auth/sign-in/email", () =>
        HttpResponse.json(
          {
            code: "INVALID_EMAIL_OR_PASSWORD",
            message: "Invalid email or password",
          },
          { status: 401 },
        ),
      ),
    );

    await logIn("jo@example.com", "wrong");

    expect(
      await screen.findByText("Invalid email or password"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  it("says to verify the email first, with a link to the check-inbox page", async () => {
    server.use(
      http.post("/api/auth/sign-in/email", () =>
        HttpResponse.json(
          { code: "EMAIL_NOT_VERIFIED", message: "Email not verified" },
          { status: 403 },
        ),
      ),
    );

    await logIn("jo+test@example.com", "correct horse");

    expect(
      await screen.findByText(
        "Verify your email first; we've sent you a new link.",
        { exact: false },
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Didn't get it?" }),
    ).toHaveAttribute("href", "/check-inbox?email=jo%2Btest%40example.com");
  });
});
