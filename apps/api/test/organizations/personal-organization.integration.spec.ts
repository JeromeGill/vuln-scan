import { INestApplication } from "@nestjs/common";
import { BaMember, BaOrganization } from "@repo/entities";
import { fixturePassword } from "@repo/fixtures";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  PERSONAL_ORGANIZATION_NAME,
  personalOrganizationSlug,
} from "../../src/auth/auth.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  signUpUnverified,
  uniqueEmail,
  type TestUser,
} from "../helpers/app.js";

describe("Organizations: personal organization (integration)", () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let user: TestUser;
  const unverifiedEmail = uniqueEmail("personal-org-unverified");

  beforeAll(async () => {
    app = await createApp();
    dataSource = app.get(DataSource);
    user = await signUp(app, "personal-org");
  });

  afterAll(() => deleteUsersAndClose(app, [user, { email: unverifiedEmail }]));

  /** A new session for `user`, through the login form's endpoint. */
  async function signIn() {
    const response = await request(app.getHttpServer())
      .post("/api/auth/sign-in/email")
      .send({ email: user.email, password: fixturePassword })
      .expect(200);
    return response.get("Set-Cookie") ?? [];
  }

  it("sign-up creates exactly one organization, owned by the user", async () => {
    const id = await signUpUnverified(app, unverifiedEmail);

    const memberships = await dataSource
      .getRepository(BaMember)
      .findBy({ userId: id });
    expect(memberships).toEqual([
      expect.objectContaining({ userId: id, role: "owner" }),
    ]);
    const [membership] = memberships;
    const organization = await dataSource
      .getRepository(BaOrganization)
      .findOneByOrFail({ id: membership?.organizationId });
    expect(organization).toMatchObject({
      name: PERSONAL_ORGANIZATION_NAME,
      slug: personalOrganizationSlug(id),
    });
    expect(
      await dataSource
        .getRepository(BaMember)
        .countBy({ organizationId: organization.id }),
    ).toBe(1);
  });

  it("a verified sign-in works in the personal organization", async () => {
    const organization = await dataSource
      .getRepository(BaOrganization)
      .findOneByOrFail({ slug: personalOrganizationSlug(user.id) });
    const cookie = await signIn();

    const session = await request(app.getHttpServer())
      .get("/api/auth/get-session")
      .set("Cookie", cookie)
      .expect(200);
    expect(session.body.session).toMatchObject({
      activeOrganizationId: organization.id,
    });

    const list = await request(app.getHttpServer())
      .get("/api/auth/organization/list")
      .set("Cookie", cookie)
      .expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: organization.id }),
    ]);

    const full = await request(app.getHttpServer())
      .get("/api/auth/organization/get-full-organization")
      .set("Cookie", cookie)
      .expect(200);
    expect(full.body).toMatchObject({
      id: organization.id,
      members: [{ userId: user.id, role: "owner" }],
    });
  });

  it("opening the verification link signs in to the personal organization", async () => {
    const organization = await dataSource
      .getRepository(BaOrganization)
      .findOneByOrFail({ slug: personalOrganizationSlug(user.id) });

    const session = await request(app.getHttpServer())
      .get("/api/auth/get-session")
      .set("Cookie", user.cookie)
      .expect(200);
    expect(session.body.session).toMatchObject({
      activeOrganizationId: organization.id,
    });
  });

  it("a user can't create another organization", async () => {
    const cookie = await signIn();

    await request(app.getHttpServer())
      .post("/api/auth/organization/create")
      .set("Cookie", cookie)
      .send({ name: "Another", slug: uniqueEmail("another-org") })
      .expect(403);
    expect(
      await dataSource.getRepository(BaMember).countBy({ userId: user.id }),
    ).toBe(1);
  });

  it("a user can't delete their personal organization", async () => {
    const organization = await dataSource
      .getRepository(BaOrganization)
      .findOneByOrFail({ slug: personalOrganizationSlug(user.id) });
    const cookie = await signIn();

    const response = await request(app.getHttpServer())
      .post("/api/auth/organization/delete")
      .set("Cookie", cookie)
      .send({ organizationId: organization.id });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(
      await dataSource
        .getRepository(BaOrganization)
        .existsBy({ id: organization.id }),
    ).toBe(true);
  });
});
