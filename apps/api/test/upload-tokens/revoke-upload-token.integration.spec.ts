import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import {
  paginated,
  projectUploadTokensPath,
  uploadTokenSchema,
  uploadTokensPath,
  type CreatedUploadTokenDto,
  type ProjectDto,
} from "@repo/contracts";
import { UploadToken } from "@repo/entities";
import { projects, uploadTokens } from "@repo/fixtures";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import { createProject, createUploadToken } from "../helpers/builders.js";

describe(`DELETE ${uploadTokensPath}/{id}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  let project: ProjectDto;
  /** Another project of the owner's organization. */
  let sibling: ProjectDto;
  /** The token the invalid requests try to revoke. */
  let token: CreatedUploadTokenDto;

  const api = () => request(app.getHttpServer());

  /** The ids of the tokens `projectId` lists, as the owner. */
  async function listedIds(projectId: string): Promise<string[]> {
    const res = await api()
      .get(projectUploadTokensPath(projectId))
      .set("Cookie", owner.cookie)
      .expect(200);
    return paginated(uploadTokenSchema)
      .parse(res.body)
      .items.map(({ id }) => id);
  }

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "revoke-upload-token-owner");
    other = await signUp(app, "revoke-upload-token-other");
    project = await createProject(app, owner, { name: projects[0].name });
    sibling = await createProject(app, owner, { name: projects[1].name });
    token = await createUploadToken(app, owner, project.id, {
      name: uploadTokens[0].name,
      expiresInDays: null,
    });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it("S-0002 AC4: revokes the token, which leaves the list", async () => {
    const revoked = await createUploadToken(app, owner, project.id, {
      name: uploadTokens[1].name,
      expiresInDays: 90,
    });

    const before = Date.now();
    const res = await api()
      .delete(`${projectUploadTokensPath(project.id)}/${revoked.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);
    expect(res.text).toBe("");

    expect(await listedIds(project.id)).not.toContain(revoked.id);
    // Kept, so an upload with it can be told it was revoked (S-0003).
    const row = await app
      .get(DataSource)
      .getRepository(UploadToken)
      .findOneByOrFail({ id: revoked.id });
    expect(row.revokedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it("S-0002 AC4: answers NOT_FOUND for a token already revoked", async () => {
    const revoked = await createUploadToken(app, owner, project.id, {
      name: uploadTokens[2].name,
      expiresInDays: 30,
    });
    const path = `${projectUploadTokensPath(project.id)}/${revoked.id}`;
    await api().delete(path).set("Cookie", owner.cookie).expect(204);

    const res = await api()
      .delete(path)
      .set("Cookie", owner.cookie)
      .expect(404);
    expect(res.body).toMatchObject({
      code: "NOT_FOUND",
      message: "Upload token not found.",
    });
  });

  it.each<{
    label: string;
    cookie?: () => string[];
    projectId?: () => string;
    id?: () => string;
    status: number;
    code: string | undefined;
    message?: string;
  }>([
    {
      label: "requires a session",
      cookie: () => [],
      status: 401,
      // Better Auth's guard replies with Nest's error body, not oRPC's.
      code: undefined,
    },
    {
      label: "S-0002 AC5: answers NOT_FOUND for another organization's project",
      cookie: () => other.cookie,
      status: 404,
      code: "NOT_FOUND",
      message: "Project not found.",
    },
    {
      label: "S-0002 AC5: answers NOT_FOUND for a project that doesn't exist",
      projectId: () => randomUUID(),
      status: 404,
      code: "NOT_FOUND",
      message: "Project not found.",
    },
    {
      label: "answers NOT_FOUND for a token of another project",
      projectId: () => sibling.id,
      status: 404,
      code: "NOT_FOUND",
      message: "Upload token not found.",
    },
    {
      label: "answers NOT_FOUND for a token that doesn't exist",
      id: () => randomUUID(),
      status: 404,
      code: "NOT_FOUND",
      message: "Upload token not found.",
    },
    {
      label: "rejects a project id that isn't a uuid",
      projectId: () => "not-a-uuid",
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "rejects a token id that isn't a uuid",
      id: () => "not-a-uuid",
      status: 400,
      code: "BAD_REQUEST",
    },
  ])(
    "$label",
    async ({
      cookie = () => owner.cookie,
      projectId = () => project.id,
      id = () => token.id,
      status,
      code,
      message,
    }) => {
      const res = await api()
        .delete(`${projectUploadTokensPath(projectId())}/${id()}`)
        .set("Cookie", cookie())
        .expect(status);
      expect(res.body.code).toBe(code);
      // Rows without a message check only the code.
      expect(res.body).toMatchObject(message ? { message } : {});

      expect(await listedIds(project.id)).toContain(token.id);
    },
  );
});
