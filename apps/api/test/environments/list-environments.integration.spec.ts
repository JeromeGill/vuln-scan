import { randomUUID } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import {
  environmentSchema,
  environmentsPath,
  paginated,
  projectEnvironmentsPath,
  type ProjectDto,
} from "@repo/contracts";
import { deployments, lockfiles, projects } from "@repo/fixtures";
import { listedUploads, listEnvironmentsCases } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
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

describe(`GET ${environmentsPath}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  let other: TestUser;
  /** Has the environments of `listedUploads`. */
  let project: ProjectDto;
  /** Another project of the owner's organization. */
  let sibling: ProjectDto;
  /** An upload token for `sibling`. */
  let siblingToken: string;

  const api = () => request(app.getHttpServer());

  /** The parsed list of `projectId`'s environments, as the owner. */
  async function list(projectId: string) {
    const res = await api()
      .get(projectEnvironmentsPath(projectId))
      .set("Cookie", owner.cookie)
      .expect(200);
    return paginated(environmentSchema.strict()).parse(res.body);
  }

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "list-environments-owner");
    other = await signUp(app, "list-environments-other");
    project = await createProject(app, owner, { name: projects[0].name });
    sibling = await createProject(app, owner, { name: projects[1].name });
    const { token } = await createUploadToken(app, owner, project.id, {
      name: "CI",
      expiresInDays: null,
    });
    for (const upload of listedUploads) {
      await uploadLockfile(app, token, upload);
    }
    ({ token: siblingToken } = await createUploadToken(app, owner, sibling.id, {
      name: "CI",
      expiresInDays: null,
    }));
  });

  afterAll(() => deleteUsersAndClose(app, [owner, other]));

  it.each(listEnvironmentsCases())(
    "$label",
    async ({ request: query, response }) => {
      const res = await api()
        .get(projectEnvironmentsPath(project.id))
        .query(query)
        .set("Cookie", owner.cookie)
        .expect(200);
      expect(
        paginated(environmentSchema.strict()).parse(res.body),
      ).toMatchObject(response);
    },
  );

  it("lists nothing for a project without uploads", async () => {
    const empty = await createProject(app, owner, { name: "No uploads" });
    await expect(list(empty.id)).resolves.toEqual({ items: [], total: 0 });
  });

  it("S-0003 AC10: shows when a file of the live release was last uploaded", async () => {
    const [pnpmLock, packageLock, requirements] = lockfiles;
    const environment = "uploaded-at";
    const [v14, v15] = deployments.versions;
    const uploadedAt = async () =>
      (await list(sibling.id)).items.find(({ name }) => name === environment)
        ?.liveRelease?.uploadedAt;

    const before = Date.now();
    await uploadLockfile(app, siblingToken, {
      environment,
      version: v14,
      path: pnpmLock.path,
      file: pnpmLock.content,
    });
    const first = await uploadedAt();
    expect(first?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(first?.getTime()).toBeLessThanOrEqual(Date.now());

    // Adding a file to the live release moves the date on.
    await uploadLockfile(app, siblingToken, {
      environment,
      version: v14,
      path: requirements.path,
      file: requirements.content,
    });
    const added = await uploadedAt();
    expect(added?.getTime()).toBeGreaterThan(first?.getTime() ?? Infinity);

    // A new version is live from its own first upload.
    await uploadLockfile(app, siblingToken, {
      environment,
      version: v15,
      path: pnpmLock.path,
      file: pnpmLock.content,
    });
    const released = await uploadedAt();
    expect(released?.getTime()).toBeGreaterThan(added?.getTime() ?? Infinity);

    // Adding a file to the earlier release doesn't change the live one's.
    await uploadLockfile(app, siblingToken, {
      environment,
      version: v14,
      path: packageLock.path,
      file: packageLock.content,
    });
    await expect(uploadedAt()).resolves.toEqual(released);
  });

  it("S-0003 AC10: lists only the project's own environments", async () => {
    const [pnpmLock] = lockfiles;
    await uploadLockfile(app, siblingToken, {
      environment: "sibling-only",
      version: deployments.versions[0],
      path: pnpmLock.path,
      file: pnpmLock.content,
    });
    const { items } = await list(project.id);
    expect(items.map(({ name }) => name)).not.toContain("sibling-only");
    const { items: siblingItems } = await list(sibling.id);
    expect(siblingItems.map(({ name }) => name)).toContain("sibling-only");
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
      label: "answers NOT_FOUND for another organization's project",
      cookie: () => other.cookie,
      query: {},
      status: 404,
      code: "NOT_FOUND",
    },
    {
      label: "answers NOT_FOUND for a project that doesn't exist",
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
        .get(projectEnvironmentsPath(projectId()))
        .query(query)
        .set("Cookie", cookie())
        .expect(status);
      expect(res.body.code).toBe(code);
    },
  );
});
