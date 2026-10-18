import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import {
  paginated,
  projectSchema,
  projectsPath,
  type ProjectDto,
} from "@repo/contracts";
import { Environment, Lockfile, Release, UploadToken } from "@repo/entities";
import { deployments, lockfiles, projects, uploadTokens } from "@repo/fixtures";
import { ObjectStorage } from "@repo/storage";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource, In } from "typeorm";
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

describe(`DELETE ${projectsPath}/{id}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  /** The project the invalid requests try to delete. */
  let project: ProjectDto;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "delete-project-owner");
    other = await signUp(app, "delete-project-other");
    project = await createProject(app, owner, { name: projects[0].name });
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it("S-0001 AC5: deletes the project", async () => {
    const deleted = await createProject(app, owner, { name: projects[1].name });

    const res = await api()
      .delete(`${projectsPath}/${deleted.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);
    expect(res.text).toBe("");

    await api()
      .get(`${projectsPath}/${deleted.id}`)
      .set("Cookie", owner.cookie)
      .expect(404);
    const list = await api()
      .get(projectsPath)
      .set("Cookie", owner.cookie)
      .expect(200);
    expect(
      paginated(projectSchema)
        .parse(list.body)
        .items.map(({ id }) => id),
    ).not.toContain(deleted.id);
  });

  it("S-0001 AC5: deletes the project's upload tokens", async () => {
    const deleted = await createProject(app, owner, { name: projects[3].name });
    const token = await createUploadToken(app, owner, deleted.id, {
      name: uploadTokens[0].name,
      expiresInDays: null,
    });

    await api()
      .delete(`${projectsPath}/${deleted.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);

    await expect(
      app.get(DataSource).getRepository(UploadToken).existsBy({ id: token.id }),
    ).resolves.toBe(false);
  });

  it("S-0001 AC5: deletes the project's environments, releases and stored files", async () => {
    const deleted = await createProject(app, owner, {
      name: `${projects[3].name} uploads`,
    });
    const token = await createUploadToken(app, owner, deleted.id, {
      name: uploadTokens[0].name,
      expiresInDays: null,
    });
    for (const [index, lockfile] of lockfiles.entries()) {
      await uploadLockfile(app, token.token, {
        environment: deployments.environments[index % 2] ?? "production",
        version: deployments.versions[index % 3] ?? "v1",
        path: lockfile.path,
        file: lockfile.content,
      });
    }
    const dataSource = app.get(DataSource);
    const environmentIds = (
      await dataSource
        .getRepository(Environment)
        .findBy({ projectId: deleted.id })
    ).map(({ id }) => id);
    const releaseIds = (
      await dataSource
        .getRepository(Release)
        .findBy({ environmentId: In(environmentIds) })
    ).map(({ id }) => id);
    const keys = (
      await dataSource
        .getRepository(Lockfile)
        .findBy({ releaseId: In(releaseIds) })
    ).map(({ storageKey }) => storageKey);
    expect(keys).toHaveLength(lockfiles.length);

    await api()
      .delete(`${projectsPath}/${deleted.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);

    await expect(
      dataSource.getRepository(Environment).existsBy({ projectId: deleted.id }),
    ).resolves.toBe(false);
    await expect(
      dataSource.getRepository(Release).existsBy({ id: In(releaseIds) }),
    ).resolves.toBe(false);
    await expect(
      dataSource
        .getRepository(Lockfile)
        .existsBy({ releaseId: In(releaseIds) }),
    ).resolves.toBe(false);
    const storage = app.get(ObjectStorage);
    for (const key of keys) {
      await expect(storage.headObject(key)).resolves.toBeNull();
    }
  });

  it("S-0001 AC5: frees the name for a new project", async () => {
    const deleted = await createProject(app, owner, { name: projects[2].name });
    await api()
      .delete(`${projectsPath}/${deleted.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);

    await createProject(app, owner, { name: projects[2].name });
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
        .delete(`${projectsPath}/${id()}`)
        .set("Cookie", cookie())
        .expect(status);
      expect(res.body.code).toBe(code);

      const fetched = await api()
        .get(`${projectsPath}/${project.id}`)
        .set("Cookie", owner.cookie)
        .expect(200);
      expect(projectSchema.parse(fetched.body)).toEqual(project);
    },
  );
});
