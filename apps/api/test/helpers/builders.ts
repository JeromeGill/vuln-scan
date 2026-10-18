import { INestApplication } from "@nestjs/common";
import {
  projectSchema,
  projectsPath,
  type CreateProject,
  type ProjectDto,
} from "@repo/contracts";
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
