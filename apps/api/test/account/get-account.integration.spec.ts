import { INestApplication } from "@nestjs/common";
import { accountPath, accountSchema } from "@repo/contracts";
import { users } from "@repo/fixtures";
import request from "supertest";
import { App } from "supertest/types.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";

describe(`GET ${accountPath}`, () => {
  let app: INestApplication<App>;
  let user: TestUser;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    user = await signUp(app, "get-account");
  });

  afterAll(() => deleteUsersAndClose(app, [user]));

  it("returns the signed-in user", async () => {
    const res = await api()
      .get(accountPath)
      .set("Cookie", user.cookie)
      .expect(200);
    expect(accountSchema.strict().parse(res.body)).toEqual({
      id: user.id,
      name: users[0].name,
      email: user.email,
    });
  });

  it("requires a session", async () => {
    const res = await api().get(accountPath).expect(401);
    // Better Auth's guard replies with Nest's error body, not oRPC's.
    expect(res.body.code).toBeUndefined();
  });
});
