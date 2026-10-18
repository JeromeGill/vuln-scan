import { randomBytes } from "node:crypto";
import type { APIRequestContext } from "@playwright/test";
import { fixturePassword, users } from "@repo/fixtures";
import { z } from "zod";
import { verificationLink } from "./mailpit.ts";

/**
 * Test data, created through the api (via the web app's /api proxy). Pass
 * `page.request`: it shares the page's cookies, so the data belongs to the
 * signed-in user, and a sign-up signs the page in.
 */

/** e.g. "k3j9xq": unique enough for names and emails in one run. */
export function uniqueSuffix(): string {
  return randomBytes(4).toString("hex").slice(0, 6);
}

async function post(request: APIRequestContext, path: string, data: object) {
  const response = await request.post(`/api${path}`, { data });
  if (!response.ok()) {
    throw new Error(
      `POST /api${path}: ${response.status()} ${await response.text()}`,
    );
  }
  return response;
}

/**
 * Signs up a new user and opens the link from its verification email (from
 * Mailpit), which verifies it and signs `request`'s context in.
 */
export async function signUp(request: APIRequestContext) {
  const user = {
    name: users[0].name,
    email: `e2e-${uniqueSuffix()}@example.com`,
    password: fixturePassword,
  };
  await post(request, "/auth/sign-up/email", user);
  // Better Auth answers with a redirect and the session cookie; the page it
  // leads to doesn't matter here.
  const response = await request.get(await verificationLink(user.email), {
    maxRedirects: 0,
  });
  if (response.status() !== 302) {
    throw new Error(`Opening the verification link: ${response.status()}`);
  }
  return user;
}

const createdProject = z.object({ id: z.uuid(), name: z.string() });

/** Creates a project named `name` in the signed-in user's organization. */
export async function createProject(request: APIRequestContext, name: string) {
  const response = await post(request, "/projects", { name });
  return createdProject.parse(await response.json());
}
