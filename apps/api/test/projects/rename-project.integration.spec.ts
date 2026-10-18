import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { projectSchema, projectsPath, type ProjectDto } from "@repo/contracts";
import { projects } from "@repo/fixtures";
import { renameProjectCases } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import { createProject } from "../helpers/builders.js";

describe(`PATCH ${projectsPath}/{id}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  /** The project the invalid requests try to rename. */
  let project: ProjectDto;
  /** Another project of the owner's organization, whose name is taken. */
  let sibling: ProjectDto;
  /** The users the success cases sign up, one each. */
  const caseUsers: TestUser[] = [];

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "rename-project-owner");
    other = await signUp(app, "rename-project-other");
    project = await createProject(app, owner, { name: projects[2].name });
    sibling = await createProject(app, owner, { name: projects[3].name });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other, ...caseUsers]));

  // Each case renames a project of its own, in an organization of its own,
  // so the names the other cases use don't get in the way.
  it.each(renameProjectCases())(
    "$label",
    async ({ given, request: body, response }) => {
      const user = await signUp(app, "rename-project-case");
      caseUsers.push(user);
      const renamed = await createProject(app, user, given);

      const res = await api()
        .patch(`${projectsPath}/${renamed.id}`)
        .set("Cookie", user.cookie)
        .send(body)
        .expect(200);
      const result = projectSchema.strict().parse(res.body);
      expect(result).toMatchObject({ ...response, id: renamed.id });
      expect(result.updatedAt.getTime()).toBeGreaterThan(
        renamed.updatedAt.getTime(),
      );

      const fetched = await api()
        .get(`${projectsPath}/${renamed.id}`)
        .set("Cookie", user.cookie)
        .expect(200);
      expect(projectSchema.parse(fetched.body)).toEqual(result);
    },
  );

  it.each<{
    label: string;
    cookie?: () => string[];
    id?: () => string;
    body: object;
    status: number;
    code: string | undefined;
    message?: string;
  }>([
    {
      label: "requires a session",
      cookie: () => [],
      body: { name: "No session" },
      status: 401,
      // Better Auth's guard replies with Nest's error body, not oRPC's.
      code: undefined,
    },
    {
      label: "S-0001 AC6: answers NOT_FOUND for another organization's project",
      cookie: () => other.cookie,
      body: { name: "Taken over" },
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "S-0001 AC6: answers NOT_FOUND for a project that doesn't exist",
      id: () => randomUUID(),
      body: { name: "Nowhere" },
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "S-0001 AC4: rejects an empty name",
      body: { name: "" },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0001 AC4: rejects a name of only spaces",
      body: { name: "   " },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0001 AC4: rejects a name over 100 characters",
      body: { name: "a".repeat(101) },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label:
        "S-0001 AC4: rejects a name another project of the organization uses",
      body: { name: projects[3].name },
      status: 409,
      code: "CONFLICT",
      message: "A project with this name already exists.",
    },
    {
      label:
        "S-0001 AC4: rejects a name another project of the organization uses, ignoring case",
      body: { name: projects[3].name.toLowerCase() },
      status: 409,
      code: "CONFLICT",
      message: "A project with this name already exists.",
    },
  ])(
    "$label",
    async ({
      cookie = () => owner.cookie,
      id = () => project.id,
      body,
      status,
      code,
      message,
    }) => {
      const res = await api()
        .patch(`${projectsPath}/${id()}`)
        .set("Cookie", cookie())
        .send(body)
        .expect(status);
      expect(res.body.code).toBe(code);
      // Rows without a message check only the code.
      expect(res.body).toMatchObject(message ? { message } : {});

      for (const unchanged of [project, sibling]) {
        const fetched = await api()
          .get(`${projectsPath}/${unchanged.id}`)
          .set("Cookie", owner.cookie)
          .expect(200);
        expect(projectSchema.parse(fetched.body)).toEqual(unchanged);
      }
    },
  );
});
