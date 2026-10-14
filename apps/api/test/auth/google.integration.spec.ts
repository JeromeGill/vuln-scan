import { INestApplication } from "@nestjs/common";
import { env } from "@repo/config/api";
import { BaAccount, BaUser } from "@repo/entities";
import { fixturePassword, users } from "@repo/fixtures";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  createApp,
  deleteUsersAndClose,
  publisher,
  signUp,
  signUpUnverified,
  uniqueEmail,
} from "../helpers/app.js";

/** Google's endpoints, mocked; the requests to the app go through. */
const google = setupServer();

const part = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * An ID token as Google's token endpoint returns it. Better Auth reads it
 * without checking the signature, since it came straight from Google.
 */
function idToken(profile: { email: string; emailVerified: boolean }) {
  const now = Math.floor(Date.now() / 1000);
  return [
    part({ alg: "RS256", typ: "JWT" }),
    part({
      iss: "https://accounts.google.com",
      aud: env.GOOGLE_CLIENT_ID,
      sub: `google-${profile.email}`,
      email: profile.email,
      email_verified: profile.emailVerified,
      name: users[0].name,
      iat: now,
      exp: now + 3600,
    }),
    "signature",
  ].join(".");
}

/** Google exchanges the authorization code for tokens for `profile`. */
function googleSignsIn(profile: { email: string; emailVerified: boolean }) {
  google.use(
    http.post("https://oauth2.googleapis.com/token", () =>
      HttpResponse.json({
        access_token: "access-token",
        id_token: idToken(profile),
        expires_in: 3600,
        token_type: "Bearer",
        scope: "openid email profile",
      }),
    ),
  );
}

/** The signed-in user of `agent`'s session, or null. */
async function sessionUser(agent: ReturnType<typeof request.agent>) {
  const response = await agent.get("/api/auth/get-session").expect(200);
  // Better Auth's response body is untyped (`any`); null when signed out.
  const user: unknown = response.body?.user;
  return user ?? null;
}

describe("Auth: sign in with Google (integration)", () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const emails: string[] = [];

  const newEmail = (label: string) => {
    const email = uniqueEmail(label);
    emails.push(email);
    return email;
  };

  /**
   * Starts a Google sign-in as the web app does, then comes back from
   * Google with `query` (by default, an authorization code). Returns the
   * agent, which holds the cookies, and the callback's redirect.
   */
  async function signInWithGoogle(
    query: Record<string, string> = { code: "authorization-code" },
  ) {
    const agent = request.agent(app.getHttpServer());
    const start = await agent
      .post("/api/auth/sign-in/social")
      .send({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/login",
      })
      .expect(200);
    const state = new URL(start.body.url).searchParams.get("state") ?? "";
    const callback = await agent
      .get("/api/auth/callback/google")
      .query({ state, ...query })
      .expect(302);
    return { agent, location: callback.get("Location") };
  }

  beforeAll(async () => {
    google.listen({ onUnhandledFrame: "bypass" });
    app = await createApp();
    dataSource = app.get(DataSource);
  });

  afterEach(() => google.resetHandlers());

  afterAll(async () => {
    google.close();
    await deleteUsersAndClose(
      app,
      emails.map((email) => ({ email })),
    );
  });

  it("sends the browser to Google, to come back to the web origin", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/sign-in/social")
      .send({ provider: "google", callbackURL: "/dashboard" })
      .expect(200);

    const url = new URL(response.body.url);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: `${env.BETTER_AUTH_URL}/api/auth/callback/google`,
      prompt: "select_account",
    });
  });

  it("the first time, creates a verified account and signs in", async () => {
    const email = newEmail("google-new");
    googleSignsIn({ email, emailVerified: true });

    const { agent, location } = await signInWithGoogle();

    expect(location).toBe("/dashboard");
    expect(await sessionUser(agent)).toMatchObject({
      email,
      name: users[0].name,
      emailVerified: true,
    });
    const user = await dataSource
      .getRepository(BaUser)
      .findOneByOrFail({ email });
    expect(
      await dataSource.getRepository(BaAccount).findBy({ userId: user.id }),
    ).toEqual([expect.objectContaining({ providerId: "google" })]);
    expect(publisher.verificationEmails(email)).toEqual([]);
  });

  it("signs in to the verified account with that email, which can still use its password", async () => {
    const existing = await signUp(app, "google-existing");
    emails.push(existing.email);
    googleSignsIn({ email: existing.email, emailVerified: true });

    const { agent, location } = await signInWithGoogle();

    expect(location).toBe("/dashboard");
    expect(await sessionUser(agent)).toMatchObject({ id: existing.id });
    const accounts = await dataSource
      .getRepository(BaAccount)
      .findBy({ userId: existing.id });
    expect(accounts.map((account) => account.providerId).toSorted()).toEqual([
      "credential",
      "google",
    ]);
    await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email: existing.email, password: fixturePassword })
      .expect(200);
  });

  // Better Auth's default (`account.accountLinking.requireLocalEmailVerified`,
  // true in 1.7.7): this fails if an upgrade changes it.
  it("doesn't sign in to an unverified account with that email", async () => {
    const email = newEmail("google-unverified");
    const id = await signUpUnverified(app, email);
    googleSignsIn({ email, emailVerified: true });

    const { agent, location } = await signInWithGoogle();

    expect(location).toBe("/login?error=account_not_linked");
    expect(await sessionUser(agent)).toBeNull();
    const user = await dataSource.getRepository(BaUser).findOneByOrFail({ id });
    expect(user.emailVerified).toBe(false);
    expect(
      await dataSource
        .getRepository(BaAccount)
        .existsBy({ userId: id, providerId: "google" }),
    ).toBe(false);
  });

  it("cancelling on Google's page comes back to the login page with the error", async () => {
    const { agent, location } = await signInWithGoogle({
      error: "access_denied",
    });

    expect(location).toBe("/login?error=access_denied");
    expect(await sessionUser(agent)).toBeNull();
  });

  it("an error from Google comes back to the login page with the error", async () => {
    google.use(
      http.post("https://oauth2.googleapis.com/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );

    const { agent, location } = await signInWithGoogle();

    expect(location).toBe("/login?error=invalid_code");
    expect(await sessionUser(agent)).toBeNull();
  });
});
