import { INestApplication } from "@nestjs/common";
import {
  maxLockfileBytes,
  projectUploadTokensPath,
  supportedLockfileNames,
  uploadedLockfileSchema,
  uploadsPath,
  type CreatedUploadTokenDto,
  type ProjectDto,
} from "@repo/contracts";
import { Environment, Lockfile, Release, UploadToken } from "@repo/entities";
import { deployments, lockfiles, projects, uploadTokens } from "@repo/fixtures";
import { createUploadCases, type UploadRequest } from "@repo/fixtures/api";
import { ObjectStorage } from "@repo/storage";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource } from "typeorm";
import { projectStoragePrefix } from "../../src/storage/keys.js";
import {
  createApp,
  deleteUsersAndClose,
  signUp,
  type TestUser,
} from "../helpers/app.js";
import {
  createProject,
  createUploadToken,
  postUpload,
  uploadLockfile,
} from "../helpers/builders.js";

/** A valid upload; the invalid requests change one thing about it. */
const valid: UploadRequest = {
  environment: deployments.environments[0],
  version: deployments.versions[0],
  path: lockfiles[0].path,
  file: lockfiles[0].content,
};

const supportedMessage = `Upload one of the supported files: ${supportedLockfileNames.join(", ")}.`;
const environmentMessage =
  "Use 1–64 lowercase letters, digits, '.', '-' and '_', starting with a letter or digit.";
const versionMessage = "Use 1–128 printable characters.";
const relativeMessage = "Use a relative path, without a leading '/' or '..'.";

/** Everything a stream yields, as one buffer. */
async function readAll(stream: AsyncIterable<unknown>): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    if (typeof chunk === "string" || chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    }
  }
  return Buffer.concat(chunks);
}

describe(`POST ${uploadsPath}`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;
  /** The project the invalid requests try to upload to. */
  let project: ProjectDto;
  let token: CreatedUploadTokenDto;
  let revoked: CreatedUploadTokenDto;
  let expired: CreatedUploadTokenDto;
  let projectCount = 0;

  const dataSource = () => app.get(DataSource);

  /** A new project of the owner's, with a token for it. */
  async function projectWithToken() {
    projectCount += 1;
    const created = await createProject(app, owner, {
      name: `${projects[0].name} ${projectCount}`,
    });
    const createdToken = await createUploadToken(app, owner, created.id, {
      name: uploadTokens[0].name,
      expiresInDays: null,
    });
    return { project: created, token: createdToken };
  }

  beforeAll(async () => {
    app = await createApp();
    owner = await signUp(app, "create-upload-owner");
    ({ project, token } = await projectWithToken());
    revoked = await createUploadToken(app, owner, project.id, {
      name: uploadTokens[1].name,
      expiresInDays: 30,
    });
    await request(app.getHttpServer())
      .delete(`${projectUploadTokensPath(project.id)}/${revoked.id}`)
      .set("Cookie", owner.cookie)
      .expect(204);
    expired = await createUploadToken(app, owner, project.id, {
      name: uploadTokens[2].name,
      expiresInDays: 30,
    });
    // No token can be made already expired through the api.
    await dataSource()
      .getRepository(UploadToken)
      .update({ id: expired.id }, { expiresAt: new Date(Date.now() - 1000) });
  });

  afterAll(() => deleteUsersAndClose(app, [owner]));

  it.each(createUploadCases())(
    "$label",
    async ({ given, request: body, response }) => {
      const target = await projectWithToken();
      for (const earlier of given) {
        await uploadLockfile(app, target.token.token, earlier);
      }

      const res = await postUpload(app, target.token.token, body).expect(201);
      expect(uploadedLockfileSchema.strict().parse(res.body)).toMatchObject(
        response,
      );

      // The rows behind the response, and the stored file.
      const environment = await dataSource()
        .getRepository(Environment)
        .findOneByOrFail({
          projectId: target.project.id,
          name: body.environment,
        });
      const release = await dataSource()
        .getRepository(Release)
        .findOneByOrFail({
          environmentId: environment.id,
          version: body.version,
        });
      expect(environment.liveReleaseId === release.id).toBe(res.body.live);
      const [lockfile, ...more] = await dataSource()
        .getRepository(Lockfile)
        .findBy({ releaseId: release.id, path: body.path });
      expect(more).toHaveLength(0);
      if (!lockfile) throw new Error("No lockfile row.");
      expect(lockfile.size).toBe(Buffer.byteLength(body.file));
      expect(
        lockfile.storageKey.startsWith(projectStoragePrefix(target.project.id)),
      ).toBe(true);
      const stored = await app
        .get(ObjectStorage)
        .getObject(lockfile.storageKey);
      expect((await readAll(stored.body)).toString()).toBe(body.file);
    },
  );

  it("S-0003 AC4: keeps the earlier release when a new one becomes live", async () => {
    const target = await projectWithToken();
    const [v1, v2] = deployments.versions;
    await uploadLockfile(app, target.token.token, { ...valid, version: v1 });
    await uploadLockfile(app, target.token.token, { ...valid, version: v2 });

    const environment = await dataSource()
      .getRepository(Environment)
      .findOneByOrFail({ projectId: target.project.id });
    const releases = await dataSource()
      .getRepository(Release)
      .findBy({ environmentId: environment.id });
    expect(releases.map(({ version }) => version).toSorted()).toEqual(
      [v1, v2].toSorted(),
    );
    expect(
      releases.find(({ id }) => id === environment.liveReleaseId)?.version,
    ).toBe(v2);
  });

  it.each<{
    label: string;
    token?: () => string | null;
    body?: Partial<Omit<UploadRequest, "file">> & { file?: string | Buffer };
    status: number;
    code: string;
    message?: string;
    /** A validation issue's message, for a `BAD_REQUEST`. */
    issue?: string;
  }>([
    {
      label: "S-0003 AC2: rejects a request without a token",
      token: () => null,
      status: 401,
      code: "UNAUTHORIZED",
      message:
        "Send an upload token: Authorization: Bearer vs_… (create one on the project's page).",
    },
    {
      label: "S-0003 AC2: rejects a token that isn't an upload token",
      token: () => "not-a-token",
      status: 401,
      code: "UNAUTHORIZED",
    },
    {
      label: "S-0003 AC2: rejects an unknown token",
      token: () => `vs_${"x".repeat(43)}`,
      status: 401,
      code: "UNAUTHORIZED",
      message: "This upload token isn't valid, or was revoked.",
    },
    {
      label: "S-0003 AC2: rejects a revoked token",
      token: () => revoked.token,
      status: 401,
      code: "UNAUTHORIZED",
      message: "This upload token isn't valid, or was revoked.",
    },
    {
      label: "S-0003 AC2: rejects an expired token",
      token: () => expired.token,
      status: 401,
      code: "UNAUTHORIZED",
      message: "This upload token has expired.",
    },
    ...[
      { what: "a missing name", environment: undefined },
      { what: "an empty name", environment: "" },
      { what: "capital letters", environment: "Production" },
      { what: "a name starting with '-'", environment: "-production" },
      { what: "a name starting with '.'", environment: ".production" },
      { what: "a space", environment: "pre production" },
      { what: "a '/'", environment: "eu/production" },
      { what: "letters beyond ASCII", environment: "prødúction" },
      { what: "a name over 64 characters", environment: "p".repeat(65) },
    ].map(({ what, environment }) => ({
      label: `S-0003 AC3: rejects an environment with ${what}`,
      body: { ...valid, environment },
      status: 400,
      code: "BAD_REQUEST",
      issue: environment === undefined ? undefined : environmentMessage,
    })),
    ...[
      { what: "a missing version", version: undefined },
      { what: "an empty version", version: "" },
      { what: "a version over 128 characters", version: "v".repeat(129) },
      { what: "a newline", version: "v1.4.0\n" },
      { what: "a tab", version: "v1.4.0\t" },
    ].map(({ what, version }) => ({
      label: `S-0003 AC6: rejects ${what}`,
      body: { ...valid, version },
      status: 400,
      code: "BAD_REQUEST",
      issue: version === undefined ? undefined : versionMessage,
    })),
    ...[
      {
        what: "an absolute path",
        path: "/pnpm-lock.yaml",
        issue: relativeMessage,
      },
      {
        what: "a path out of the repository",
        path: "../pnpm-lock.yaml",
        issue: relativeMessage,
      },
      {
        what: "a path with '..' inside",
        path: "apps/../pnpm-lock.yaml",
        issue: relativeMessage,
      },
      {
        what: "an unsupported file",
        path: "Gemfile.lock",
        issue: supportedMessage,
      },
      {
        what: "a supported name in another case",
        path: "PNPM-LOCK.YAML",
        issue: supportedMessage,
      },
      {
        what: "a supported name inside another",
        path: "my-pnpm-lock.yaml",
        issue: supportedMessage,
      },
      {
        what: "a folder named like a lockfile",
        path: "yarn.lock/notes.md",
        issue: supportedMessage,
      },
      {
        what: "a path over 255 characters",
        path: `${"d/".repeat(121)}pnpm-lock.yaml`.padStart(256, "x"),
        issue: "Use a path of at most 255 characters.",
      },
      { what: "a missing path", path: undefined, issue: undefined },
    ].map(({ what, path, issue }) => ({
      label: `S-0003 AC7: rejects ${what}`,
      body: { ...valid, path },
      status: 400,
      code: "BAD_REQUEST",
      issue,
    })),
    {
      label: "rejects a request without a file",
      body: { ...valid, file: undefined },
      status: 400,
      code: "BAD_REQUEST",
    },
    {
      label: "S-0003 AC8: rejects a file one byte over 20 MB",
      body: { ...valid, file: Buffer.alloc(maxLockfileBytes + 1, "a") },
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Upload a file of at most 20 MB.",
    },
    {
      label: "S-0003 AC8: rejects a body far over 20 MB before reading it",
      body: { ...valid, file: Buffer.alloc(maxLockfileBytes + 1024 * 1024) },
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
      message: "Upload a file of at most 20 MB.",
    },
  ])(
    "$label",
    async ({
      token: tokenOf = () => token.token,
      body = valid,
      status,
      code,
      message,
      issue,
    }) => {
      const res = await postUpload(app, tokenOf(), body).expect(status);
      expect(res.body.code).toBe(code);
      // Rows without a message check only the code.
      expect(res.body).toMatchObject(message ? { message } : {});
      // The validation issues' messages; rows without an issue skip this.
      const issues: unknown = res.body.data?.issues;
      const messages = Array.isArray(issues)
        ? issues.map((entry: { message?: unknown }) => entry.message)
        : [];
      expect(issue === undefined || messages.includes(issue)).toBe(true);

      // Nothing stored, and the token not marked used.
      await expect(
        dataSource()
          .getRepository(Environment)
          .existsBy({ projectId: project.id }),
      ).resolves.toBe(false);
      const row = await dataSource()
        .getRepository(UploadToken)
        .findOneByOrFail({ id: token.id });
      expect(row.lastUsedAt).toBeNull();
    },
  );
});

describe(`POST ${uploadsPath} without storage`, () => {
  let app: INestApplication<App>;
  let owner: TestUser;

  beforeAll(async () => {
    app = await createApp({ storage: false });
    owner = await signUp(app, "create-upload-no-storage");
  });

  afterAll(() => deleteUsersAndClose(app, [owner]));

  it("answers SERVICE_UNAVAILABLE and stores nothing", async () => {
    const project = await createProject(app, owner, {
      name: projects[0].name,
    });
    const token = await createUploadToken(app, owner, project.id, {
      name: uploadTokens[0].name,
      expiresInDays: null,
    });

    const res = await postUpload(app, token.token, valid).expect(503);
    expect(res.body).toMatchObject({ code: "SERVICE_UNAVAILABLE" });

    await expect(
      app
        .get(DataSource)
        .getRepository(Environment)
        .existsBy({ projectId: project.id }),
    ).resolves.toBe(false);
  });
});
