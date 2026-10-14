import { INestApplication } from "@nestjs/common";
import { BaAccount, BaSession, BaUser } from "@repo/entities";
import { fixturePassword, users } from "@repo/fixtures";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  createApp,
  deleteUsersAndClose,
  publisher,
  uniqueEmail,
} from "../helpers/app.js";

describe("Auth: sign up (integration)", () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  const email = uniqueEmail("sign-up");
  const { name } = users[0];

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
  });

  afterAll(() => deleteUsersAndClose(app, [{ email }]));

  it("POST /api/auth/sign-up/email creates an unverified user, without signing in", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/auth/sign-up/email")
      .send({
        name,
        email,
        password: fixturePassword,
        callbackURL: "/verify-email",
      })
      .expect(200);

    expect(response.body).toMatchObject({
      token: null,
      user: { name, email, emailVerified: false },
    });
    expect(response.get("Set-Cookie") ?? []).toEqual([]);

    const user = await dataSource
      .getRepository(BaUser)
      .findOneByOrFail({ email });
    expect(user).toMatchObject({ id: response.body.user.id, email });

    const account = await dataSource
      .getRepository(BaAccount)
      .findOneByOrFail({ userId: user.id });
    expect(account).toMatchObject({ providerId: "credential" });
    expect(account.password).toEqual(expect.any(String));
    expect(account.password).not.toBe(fixturePassword);

    expect(
      await dataSource.getRepository(BaSession).findBy({ userId: user.id }),
    ).toHaveLength(0);

    // The verification email job, for the worker to send.
    const [job] = publisher.verificationEmails(email);
    expect(job?.data).toMatchObject({ userId: user.id, email, name });
    const link = new URL(job?.data.url ?? "");
    expect(link.pathname).toBe("/api/auth/verify-email");
    expect(link.searchParams.get("callbackURL")).toBe("/verify-email");
    // The link works for an hour (Better Auth's default).
    const expiresIn = Date.parse(job?.data.expiresAt ?? "") - Date.now();
    expect(expiresIn).toBeGreaterThan(59 * 60 * 1000);
    expect(expiresIn).toBeLessThanOrEqual(60 * 60 * 1000);
  });
});
