import { INestApplication } from "@nestjs/common";
import { paginated, projectSchema, projectsPath } from "@repo/contracts";
import { projects } from "@repo/fixtures";
import { createProjectCases } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import { createProject } from "../helpers/builders.js";

/** A name the owner's organization already uses (see `beforeAll`). */
const taken = projects[3].name;

describe(`POST ${projectsPath}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;

  const api = () => request(app.getHttpServer());

  /** How many projects the owner's organization has. */
  async function ownerProjectCount(): Promise<number> {
    const res = await api()
      .get(projectsPath)
      .set("Cookie", owner.cookie)
      .expect(200);
    return paginated(projectSchema).parse(res.body).total;
  }

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "create-project-owner");
    other = await signUp(app, "create-project-other");
    await createProject(app, owner, { name: taken });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it.each(createProjectCases())(
    "$label",
    async ({ request: body, response }) => {
      const res = await api()
        .post(projectsPath)
        .set("Cookie", owner.cookie)
        .send(body)
        .expect(201);
      const project = projectSchema.strict().parse(res.body);
      expect(project).toMatchObject(response);

      const fetched = await api()
        .get(`${projectsPath}/${project.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);
      expect(projectSchema.parse(fetched.body)).toEqual(project);
    },
  );

  it("S-0001 AC3: allows a name another organization uses", async () => {
    const res = await api()
      .post(projectsPath)
      .set("Cookie", other.cookie)
      .send({ name: taken })
      .expect(201);
    expect(projectSchema.strict().parse(res.body)).toMatchObject({
      name: taken,
    });
  });

  it.each<{
    label: string;
    cookie?: () => string[];
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
      label: "S-0001 AC2: rejects a missing name",
      body: {},
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0001 AC2: rejects an empty name",
      body: { name: "" },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0001 AC2: rejects a name of only spaces",
      body: { name: "   " },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0001 AC2: rejects a name over 100 characters",
      body: { name: "a".repeat(101) },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0001 AC3: rejects a name the organization uses",
      body: { name: taken },
      status: 409,
      code: "CONFLICT",
      message: "A project with this name already exists.",
    },
    {
      label: "S-0001 AC3: rejects a name the organization uses, ignoring case",
      body: { name: taken.toUpperCase() },
      status: 409,
      code: "CONFLICT",
      message: "A project with this name already exists.",
    },
    {
      label:
        "S-0001 AC3: rejects a name the organization uses, ignoring spaces around it",
      body: { name: ` ${taken} ` },
      status: 409,
      code: "CONFLICT",
      message: "A project with this name already exists.",
    },
  ])(
    "$label",
    async ({ cookie = () => owner.cookie, body, status, code, message }) => {
      const before = await ownerProjectCount();

      const res = await api()
        .post(projectsPath)
        .set("Cookie", cookie())
        .send(body)
        .expect(status);
      expect(res.body.code).toBe(code);
      // Rows without a message check only the code.
      expect(res.body).toMatchObject(message ? { message } : {});

      expect(await ownerProjectCount()).toBe(before);
    },
  );
});
