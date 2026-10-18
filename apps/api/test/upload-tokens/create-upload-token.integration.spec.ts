import { createHash, randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import {
  createdUploadTokenSchema,
  paginated,
  projectUploadTokensPath,
  uploadTokenSchema,
  uploadTokensPath,
  type ProjectDto,
} from "@repo/contracts";
import { UploadToken } from "@repo/entities";
import { projects, uploadTokens, users } from "@repo/fixtures";
import { createUploadTokenCases } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import { createProject } from "../helpers/builders.js";

const dayMs = 24 * 60 * 60 * 1000;

describe(`POST ${uploadTokensPath}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  let project: ProjectDto;

  const api = () => request(app.getHttpServer());

  /** How many tokens the project lists. */
  async function tokenCount(): Promise<number> {
    const res = await api()
      .get(projectUploadTokensPath(project.id))
      .set("Cookie", owner.cookie)
      .expect(200);
    return paginated(uploadTokenSchema).parse(res.body).total;
  }

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "create-upload-token-owner");
    other = await signUp(app, "create-upload-token-other");
    project = await createProject(app, owner, { name: projects[0].name });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it.each(createUploadTokenCases())(
    "$label",
    async ({ request: body, response }) => {
      const before = Date.now();
      const res = await api()
        .post(projectUploadTokensPath(project.id))
        .set("Cookie", owner.cookie)
        .send(body)
        .expect(201);
      const after = Date.now();
      const created = createdUploadTokenSchema.strict().parse(res.body);
      expect(created).toMatchObject({
        ...response,
        createdBy: { id: owner.id, name: users[0].name },
      });
      expect(created.token).toMatch(/^vs_[A-Za-z0-9_-]{43}$/);
      expect(created.lastFour).toBe(created.token.slice(-4));
      // Expires `expiresInDays` after the request, or never when it's null
      // (then the range checks below compare the request time with itself).
      expect(created.expiresAt === null).toBe(body.expiresInDays === null);
      const lifetime = (body.expiresInDays ?? 0) * dayMs;
      const expiresAt = created.expiresAt?.getTime() ?? before + lifetime;
      expect(expiresAt).toBeGreaterThanOrEqual(before + lifetime);
      expect(expiresAt).toBeLessThanOrEqual(after + lifetime);

      const list = await api()
        .get(projectUploadTokensPath(project.id))
        .set("Cookie", owner.cookie)
        .expect(200);
      const { token: _token, ...listed } = created;
      expect(
        paginated(uploadTokenSchema).parse(list.body).items,
      ).toContainEqual(listed);
    },
  );

  it("S-0002 AC3: stores only the token's SHA-256 hash and last four characters", async () => {
    const res = await api()
      .post(projectUploadTokensPath(project.id))
      .set("Cookie", owner.cookie)
      .send({ name: uploadTokens[0].name, expiresInDays: null })
      .expect(201);
    const { id, token } = createdUploadTokenSchema.parse(res.body);

    const row = await app
      .get(DataSource)
      .getRepository(UploadToken)
      .findOneByOrFail({ id });
    expect(row.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(row.lastFour).toBe(token.slice(-4));
    expect(Object.values(row)).not.toContain(token);
  });

  it("S-0002 AC3: never lists the full token", async () => {
    await api()
      .post(projectUploadTokensPath(project.id))
      .set("Cookie", owner.cookie)
      .send({ name: uploadTokens[1].name, expiresInDays: 30 })
      .expect(201);

    const list = await api()
      .get(projectUploadTokensPath(project.id))
      .set("Cookie", owner.cookie)
      .expect(200);
    // strict() fails on any field beyond the listed token's, e.g. `token`.
    expect(() =>
      paginated(uploadTokenSchema.strict()).parse(list.body),
    ).not.toThrow();
    expect(JSON.stringify(list.body)).not.toMatch(/vs_/);
  });

  it("generates a different token every time", async () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const res = await api()
        .post(projectUploadTokensPath(project.id))
        .set("Cookie", owner.cookie)
        .send({ name: uploadTokens[2].name, expiresInDays: null })
        .expect(201);
      tokens.add(createdUploadTokenSchema.parse(res.body).token);
    }
    expect(tokens.size).toBe(3);
  });

  it.each<{
    label: string;
    cookie?: () => string[];
    projectId?: () => string;
    body: object;
    status: number;
    code: string | undefined;
  }>([
    {
      label: "requires a session",
      cookie: () => [],
      body: { name: "No session", expiresInDays: null },
      status: 401,
      // Better Auth's guard replies with Nest's error body, not oRPC's.
      code: undefined,
    },
    {
      label: "S-0002 AC5: answers NOT_FOUND for another organization's project",
      cookie: () => other.cookie,
      body: { name: "Taken over", expiresInDays: null },
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "S-0002 AC5: answers NOT_FOUND for a project that doesn't exist",
      projectId: () => randomUUID(),
      body: { name: "Nowhere", expiresInDays: null },
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "rejects a project id that isn't a uuid",
      projectId: () => "not-a-uuid",
      body: { name: "Bad id", expiresInDays: null },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0002 AC2: rejects a missing name",
      body: { expiresInDays: null },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0002 AC2: rejects an empty name",
      body: { name: "", expiresInDays: null },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0002 AC2: rejects a name of only spaces",
      body: { name: "   ", expiresInDays: null },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0002 AC2: rejects a name over 100 characters",
      body: { name: "a".repeat(101), expiresInDays: null },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0002 AC2: rejects a missing expiry",
      body: { name: "No expiry" },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0002 AC2: rejects an expiry other than 30, 90 or 365 days",
      body: { name: "A week", expiresInDays: 7 },
      status: 400,
      code: "BAD_REQUEST",
    },
  ])(
    "$label",
    async ({
      cookie = () => owner.cookie,
      projectId = () => project.id,
      body,
      status,
      code,
    }) => {
      const before = await tokenCount();

      const res = await api()
        .post(projectUploadTokensPath(projectId()))
        .set("Cookie", cookie())
        .send(body)
        .expect(status);
      expect(res.body.code).toBe(code);

      expect(await tokenCount()).toBe(before);
    },
  );
});
