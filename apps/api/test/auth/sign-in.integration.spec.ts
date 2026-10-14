import { INestApplication } from "@nestjs/common";
import { fixturePassword } from "@repo/fixtures";
import request from "supertest";
import { App } from "supertest/types.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";

describe("Auth: sign in (integration)", () => {
  let app: INestApplication<App>;
  let user: TestUser;

  beforeAll(async () => {
    app = await createApp();
    user = await signUp(app, "sign-in");
  });

  afterAll(() => deleteUsersAndClose(app, [user]));

  it("POST /api/auth/sign-in/email returns a session for valid credentials", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: fixturePassword })
      .expect(200);

    expect(response.body.user).toMatchObject({ email: user.email });
    expect(response.body.token).toEqual(expect.any(String));

    const cookies = response.get("Set-Cookie") ?? [];
    expect(
      cookies.some((cookie) => cookie.startsWith("better-auth.session_token=")),
    ).toBe(true);

    const session = await request(app.getHttpServer())
      .get("/api/auth/get-session")
      .set("Cookie", cookies)
      .expect(200);

    expect(session.body.user).toMatchObject({ email: user.email });
  });

  it("POST /api/auth/sign-in/email rejects a wrong password", async () => {
    await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: "wrong-password-123" })
      .expect(401);
  });
});
