import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";
import { renderWithProviders } from "../render";
import { server } from "../server";

// The sign-up form navigates with Next's router, which only exists inside a
// running Next.js app.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn<(href: string) => void>() }),
}));

describe("Sign in with Google", () => {
  it("has no button when Google sign-in is off", () => {
    renderWithProviders(
      <LoginForm googleSignIn={false} googleError={undefined} />,
    );

    expect(
      screen.queryByRole("button", { name: "Continue with Google" }),
    ).not.toBeInTheDocument();
  });

  // Better Auth's client then sends the browser to Google; the browser
  // tests follow that.
  it("starts a Google sign-in from the sign-up page", async () => {
    let sent: unknown;
    server.use(
      http.post("/api/auth/sign-in/social", async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ url: "", redirect: false });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<SignUpForm googleSignIn />);

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await vi.waitFor(() =>
      expect(sent).toEqual({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      }),
    );
  });

  it("says to verify the existing account first", () => {
    renderWithProviders(
      <LoginForm googleSignIn googleError="account_not_linked" />,
    );

    expect(
      screen.getByText(/Verify its email or log in with its password first/),
    ).toBeInTheDocument();
  });

  it("says the Google sign-in didn't work", () => {
    renderWithProviders(<LoginForm googleSignIn googleError="access_denied" />);

    expect(
      screen.getByText("Couldn't sign in with Google. Please try again."),
    ).toBeInTheDocument();
  });
});
