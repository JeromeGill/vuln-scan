import { INestApplication } from "@nestjs/common";
import {
  createdUploadTokenSchema,
  projectSchema,
  projectsPath,
  projectUploadTokensPath,
  uploadedLockfileSchema,
  uploadsPath,
  type CreatedUploadTokenDto,
  type CreateProject,
  type CreateUploadToken,
  type ProjectDto,
  type UploadedLockfileDto,
} from "@repo/contracts";
import type { UploadRequest } from "@repo/fixtures/api";
import request from "supertest";
import { App } from "supertest/types.js";
import type { TestUser } from "./app.js";

/**
 * Rows the specs need, created through the api as `user` so they go through
 * the same validation and scoping as the routes under test.
 */

/** Creates a project in `user`'s organization. */
export async function createProject(
  app: INestApplication<App>,
  user: TestUser,
  body: CreateProject,
): Promise<ProjectDto> {
  const res = await request(app.getHttpServer())
    .post(projectsPath)
    .set("Cookie", user.cookie)
    .send(body)
    .expect(201);
  return projectSchema.parse(res.body);
}

/** Creates an upload token for the project with id `projectId`. */
export async function createUploadToken(
  app: INestApplication<App>,
  user: TestUser,
  projectId: string,
  body: CreateUploadToken,
): Promise<CreatedUploadTokenDto> {
  const res = await request(app.getHttpServer())
    .post(projectUploadTokensPath(projectId))
    .set("Cookie", user.cookie)
    .send(body)
    .expect(201);
  return createdUploadTokenSchema.parse(res.body);
}

/**
 * Sends `POST /uploads` with `token` as the bearer token (none when
 * `null`), `body`'s fields as form fields, and its `file` (contents, or
 * bytes) attached under the path's file name. Returns the request to
 * `.expect()` on.
 */
export function postUpload(
  app: INestApplication<App>,
  token: string | null,
  body: Partial<Omit<UploadRequest, "file">> & { file?: string | Buffer },
) {
  const req = request(app.getHttpServer()).post(uploadsPath);
  if (token !== null) req.set("Authorization", `Bearer ${token}`);
  const { file, ...fields } = body;
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) req.field(name, value);
  }
  if (file !== undefined) {
    req.attach("file", Buffer.from(file), {
      filename: body.path?.split("/").at(-1) ?? "lockfile",
      contentType: "text/plain",
    });
  }
  return req;
}

/** Uploads a lockfile with the upload token `token`. */
export async function uploadLockfile(
  app: INestApplication<App>,
  token: string,
  body: UploadRequest,
): Promise<UploadedLockfileDto> {
  const res = await postUpload(app, token, body).expect(201);
  return uploadedLockfileSchema.parse(res.body);
}
