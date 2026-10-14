import { INestApplication } from "@nestjs/common";
import { env } from "@repo/config/api";
import { BaUser } from "@repo/entities";
import { fixturePassword } from "@repo/fixtures";
import { createEmailVerificationToken } from "better-auth/api";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  createApp,
  deleteUsersAndClose,
  publisher,
  signUpUnverified,
  uniqueEmail,
} from "../helpers/app.js";

const sessionCookie = (cookies: string[]) =>
  cookies.filter((cookie) => cookie.startsWith("better-auth.session_token="));

describe("Auth: email verification (integration)", () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const emails: string[] = [];

  /** A new user who signed up and hasn't opened the link yet. */
  const newUnverifiedUser = async (label: string) => {
    const email = uniqueEmail(label);
    emails.push(email);
    const id = await signUpUnverified(app, email);
    return { id, email };
  };

  /** Opens a link as a signed-out browser would. */
  const open = (link: string) =>
    request(app.getHttpServer()).get(link).expect(302);

  const isVerified = async (id: string) =>
    (await dataSource.getRepository(BaUser).findOneByOrFail({ id }))
      .emailVerified;

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
  });

  afterAll(() =>
    deleteUsersAndClose(
      app,
      emails.map((email) => ({ email })),
    ),
  );

  it("the link verifies the email, signs in, and goes to the callback", async () => {
    const { id, email } = await newUnverifiedUser("verify-link");

    const response = await open(publisher.verificationLink(email));

    expect(response.get("Location")).toBe("/verify-email");
    const cookie = sessionCookie(response.get("Set-Cookie") ?? []);
    expect(cookie).toHaveLength(1);
    const session = await request(app.getHttpServer())
      .get("/api/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);
    expect(session.body.user).toMatchObject({ id, emailVerified: true });
    expect(await isVerified(id)).toBe(true);
  });

  it("logging in before verifying is refused and sends a new link", async () => {
    const { email } = await newUnverifiedUser("verify-login");
    expect(publisher.verificationEmails(email)).toHaveLength(1);

    const response = await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email, password: fixturePassword, callbackURL: "/verify-email" })
      .expect(403);

    expect(response.body).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
    expect(sessionCookie(response.get("Set-Cookie") ?? [])).toEqual([]);
    expect(publisher.verificationEmails(email)).toHaveLength(2);
    expect(publisher.verificationLink(email)).toContain(
      "callbackURL=%2Fverify-email",
    );
  });

  it("sends the link again on request", async () => {
    const { email } = await newUnverifiedUser("verify-resend");

    await request(app.getHttpServer())
      .post("/api/auth/send-verification-email")
      .send({ email, callbackURL: "/verify-email" })
      .expect(200);

    expect(publisher.verificationEmails(email)).toHaveLength(2);
  });

  it("an expired link redirects with TOKEN_EXPIRED and doesn't verify", async () => {
    const { id, email } = await newUnverifiedUser("verify-expired");
    // Signed like Better Auth's, but already expired.
    const token = await createEmailVerificationToken(
      env.BETTER_AUTH_SECRET,
      email,
      undefined,
      -60,
    );

    const response = await open(
      `/api/auth/verify-email?token=${token}&callbackURL=%2Fverify-email`,
    );

    expect(response.get("Location")).toBe("/verify-email?error=TOKEN_EXPIRED");
    expect(sessionCookie(response.get("Set-Cookie") ?? [])).toEqual([]);
    expect(await isVerified(id)).toBe(false);
  });

  it("a malformed link redirects with INVALID_TOKEN", async () => {
    const response = await open(
      "/api/auth/verify-email?token=not-a-token&callbackURL=%2Fverify-email",
    );

    expect(response.get("Location")).toBe("/verify-email?error=INVALID_TOKEN");
  });

  it("a used link goes to the callback without signing in", async () => {
    const { email } = await newUnverifiedUser("verify-reuse");
    const link = publisher.verificationLink(email);
    await open(link);

    const again = await open(link);

    expect(again.get("Location")).toBe("/verify-email");
    expect(sessionCookie(again.get("Set-Cookie") ?? [])).toEqual([]);
  });
});
