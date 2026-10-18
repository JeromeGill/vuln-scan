import { INestApplication } from "@nestjs/common";
import { paginated, projectSchema, projectsPath } from "@repo/contracts";
import { listedProjects, listProjectsCases } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import { createProject } from "../helpers/builders.js";

describe(`GET ${projectsPath}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "list-projects-owner");
    other = await signUp(app, "list-projects-other");
    for (const project of listedProjects) {
      await createProject(app, owner, project);
    }
    // S-0001 AC6: in another organization, so never in the owner's list.
    await createProject(app, other, { name: "Other organization's project" });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it.each(listProjectsCases())(
    "$label",
    async ({ request: query, response }) => {
      const res = await api()
        .get(projectsPath)
        .query(query)
        .set("Cookie", owner.cookie)
        .expect(200);
      expect(paginated(projectSchema.strict()).parse(res.body)).toMatchObject(
        response,
      );
    },
  );

  it("S-0001 AC6: lists only the organization's own projects", async () => {
    const res = await api()
      .get(projectsPath)
      .set("Cookie", other.cookie)
      .expect(200);
    expect(paginated(projectSchema.strict()).parse(res.body)).toMatchObject({
      items: [{ name: "Other organization's project" }],
      total: 1,
    });
  });

  it.each<{
    label: string;
    cookie?: () => string[];
    query: Record<string, string | number>;
    status: number;
    code: string | undefined;
  }>([
    {
      label: "requires a session",
      cookie: () => [],
      query: {},
      status: 401,
      // Better Auth's guard replies with Nest's error body, not oRPC's.
      code: undefined,
    },
    {
      label: "rejects a limit over 100",
      query: { limit: 101 },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "rejects a negative offset",
      query: { offset: -1 },
      status: 400,
      code: "BAD_REQUEST",
    },
  ])("$label", async ({ cookie = () => owner.cookie, query, status, code }) => {
    const res = await api()
      .get(projectsPath)
      .query(query)
      .set("Cookie", cookie())
      .expect(status);
    expect(res.body.code).toBe(code);
  });
});
