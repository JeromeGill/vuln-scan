import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import {
  paginated,
  projectUploadTokensPath,
  uploadTokenSchema,
  uploadTokensPath,
  type ProjectDto,
} from "@repo/contracts";
import { UploadToken } from "@repo/entities";
import { deployments, lockfiles, projects, users } from "@repo/fixtures";
import { listedUploadTokens, listUploadTokensCases } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import {
  createProject,
  createUploadToken,
  uploadLockfile,
} from "../helpers/builders.js";

describe(`GET ${uploadTokensPath}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  /** Has `listedUploadTokens`, and a revoked token before them. */
  let project: ProjectDto;
  /** Another project of the owner's organization, with a token of its own. */
  let sibling: ProjectDto;

  const api = () => request(app.getHttpServer());

  /** The parsed list of `projectId`'s tokens, as the owner. */
  async function list(projectId: string) {
    const res = await api()
      .get(projectUploadTokensPath(projectId))
      .set("Cookie", owner.cookie)
      .expect(200);
    return paginated(uploadTokenSchema.strict()).parse(res.body);
  }

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "list-upload-tokens-owner");
    other = await signUp(app, "list-upload-tokens-other");
    project = await createProject(app, owner, { name: projects[0].name });
    sibling = await createProject(app, owner, { name: projects[1].name });
    // S-0002 AC4: revoked, so never listed.
    const revoked = await createUploadToken(app, owner, project.id, {
      name: "Revoked",
      expiresInDays: null,
    });
    await api()
      .delete(`${projectUploadTokensPath(project.id)}/${revoked.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);
    for (const token of listedUploadTokens) {
      await createUploadToken(app, owner, project.id, token);
    }
    await createUploadToken(app, owner, sibling.id, {
      name: "Sibling's token",
      expiresInDays: null,
    });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it.each(listUploadTokensCases())(
    "$label",
    async ({ request: query, response }) => {
      const res = await api()
        .get(projectUploadTokensPath(project.id))
        .query(query)
        .set("Cookie", owner.cookie)
        .expect(200);
      expect(
        paginated(uploadTokenSchema.strict()).parse(res.body),
      ).toMatchObject(response);
    },
  );

  it("S-0002 AC1: shows each token's last four characters and who created it", async () => {
    const { items } = await list(project.id);
    for (const token of items) {
      expect(token.lastFour).toMatch(/^[A-Za-z0-9_-]{4}$/);
      expect(token.createdBy).toEqual({ id: owner.id, name: users[0].name });
    }
  });

  it("S-0002 AC1: lists expired tokens with their expiry", async () => {
    const expired = await createUploadToken(app, owner, sibling.id, {
      name: "Expired",
      expiresInDays: 30,
    });
    const expiresAt = new Date(Date.now() - 1000);
    // No route makes a token expire early, so set it in the database.
    await app
      .get(DataSource)
      .getRepository(UploadToken)
      .update({ id: expired.id }, { expiresAt });

    const { token: _token, ...listed } = expired;
    const { items } = await list(sibling.id);
    expect(items).toContainEqual({ ...listed, expiresAt });
  });

  it("S-0003 AC9: shows when a token was last used to upload", async () => {
    const used = await createUploadToken(app, owner, sibling.id, {
      name: "Used",
      expiresInDays: null,
    });
    const before = Date.now();
    await uploadLockfile(app, used.token, {
      environment: deployments.environments[0],
      version: deployments.versions[0],
      path: lockfiles[0].path,
      file: lockfiles[0].content,
    });

    const { items } = await list(sibling.id);
    const lastUsedAt = items.find(({ id }) => id === used.id)?.lastUsedAt;
    expect(lastUsedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(lastUsedAt?.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("S-0002 AC1: lists only the project's own tokens", async () => {
    await expect(list(sibling.id)).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ name: "Sibling's token" }),
      ]),
    });
    const { items } = await list(project.id);
    expect(items.map(({ name }) => name)).not.toContain("Sibling's token");
  });

  it.each<{
    label: string;
    cookie?: () => string[];
    projectId?: () => string;
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
      label: "S-0002 AC5: answers NOT_FOUND for another organization's project",
      cookie: () => other.cookie,
      query: {},
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "S-0002 AC5: answers NOT_FOUND for a project that doesn't exist",
      projectId: () => randomUUID(),
      query: {},
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "rejects a project id that isn't a uuid",
      projectId: () => "not-a-uuid",
      query: {},
      status: 400,
      code: "BAD_REQUEST",
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
  ])(
    "$label",
    async ({
      cookie = () => owner.cookie,
      projectId = () => project.id,
      query,
      status,
      code,
    }) => {
      const res = await api()
        .get(projectUploadTokensPath(projectId()))
        .query(query)
        .set("Cookie", cookie())
        .expect(status);
      expect(res.body.code).toBe(code);
    },
  );
});
