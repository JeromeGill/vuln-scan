import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { projectSchema, projectsPath, type ProjectDto } from "@repo/contracts";
import { projects } from "@repo/fixtures";
import request from "supertest";
import { App } from "supertest/types.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import { createProject } from "../helpers/builders.js";

describe(`GET ${projectsPath}/{id}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  let project: ProjectDto;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "get-project-owner");
    other = await signUp(app, "get-project-other");
    project = await createProject(app, owner, { name: projects[0].name });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it("returns the project", async () => {
    const res = await api()
      .get(`${projectsPath}/${project.id}`)
      .set("Cookie", owner.cookie)
      .expect(200);
    expect(projectSchema.strict().parse(res.body)).toEqual(project);
  });

  it.each<{
    label: string;
    cookie?: () => string[];
    id?: () => string;
    status: number;
    code: string | undefined;
  }>([
    {
      label: "requires a session",
      cookie: () => [],
      status: 401,
      // Better Auth's guard replies with Nest's error body, not oRPC's.
      code: undefined,
    },
    {
      label: "S-0001 AC6: answers NOT_FOUND for another organization's project",
      cookie: () => other.cookie,
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "S-0001 AC6: answers NOT_FOUND for a project that doesn't exist",
      id: () => randomUUID(),
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "rejects an id that isn't a uuid",
      id: () => "not-a-uuid",
      status: 400,
      code: "BAD_REQUEST",
    },
  ])(
    "$label",
    async ({
      cookie = () => owner.cookie,
      id = () => project.id,
      status,
      code,
    }) => {
      const res = await api()
        .get(`${projectsPath}/${id()}`)
        .set("Cookie", cookie())
        .expect(status);
      expect(res.body.code).toBe(code);
    },
  );
});
