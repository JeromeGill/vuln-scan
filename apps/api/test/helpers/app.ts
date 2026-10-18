import { INestApplication } from "@nestjs/common";
import { BaMember, BaOrganization, BaUser } from "@repo/entities";
import {
  verifyEmail,
  type Envelope,
  type MessageDefinition,
  type MessageOf,
  type VerifyEmail,
} from "@repo/events";
import { Test } from "@nestjs/testing";
import { fixturePassword, users } from "@repo/fixtures";
import { ObjectStorage } from "@repo/storage";
import request from "supertest";
import { App } from "supertest/types.js";
import { DataSource, In } from "typeorm";
import { AppModule } from "../../src/app.module.js";
import { JobPublisher } from "../../src/messaging/job-publisher.js";

/**
 * Stands in for the api's `JobPublisher`, so the specs need no RabbitMQ:
 * it keeps the jobs it's given.
 */
export class FakeJobPublisher {
  readonly published: Envelope[] = [];

  async publish<Definition extends MessageDefinition>(
    definition: Definition,
    message: MessageOf<Definition>,
  ): Promise<void> {
    this.published.push(definition.schema.parse(message));
  }

  /** The verification email jobs sent to `email`, oldest first. */
  verificationEmails(email: string): VerifyEmail[] {
    return this.published.flatMap((message) => {
      const job = verifyEmail.schema.safeParse(message).data;
      return job?.data.email === email ? [job] : [];
    });
  }

  /** The path and query of the newest verification link sent to `email`. */
  verificationLink(email: string): string {
    const job = this.verificationEmails(email).at(-1);
    if (!job) throw new Error(`No verification email to ${email}.`);
    const url = new URL(job.data.url);
    return `${url.pathname}${url.search}`;
  }
}

/** Receives the jobs of every app `createApp` boots. */
export const publisher = new FakeJobPublisher();

/**
 * Boots the full `AppModule`, as `main.ts` does, with `publisher` in place
 * of RabbitMQ. With `storage: false` it runs as without `STORAGE_DRIVER`:
 * no `ObjectStorage`.
 */
export async function createApp({ storage = true } = {}): Promise<
  INestApplication<App>
> {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(JobPublisher)
    .useValue(publisher);
  if (!storage)
    builder = builder.overrideProvider(ObjectStorage).useValue(null);
  const moduleFixture = await builder.compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>({
    bodyParser: false,
  });
  await app.init();
  return app;
}

export interface TestUser {
  id: string;
  email: string;
  /** The session's `Set-Cookie` values; send back with `.set("Cookie", …)`. */
  cookie: string[];
}

/** An email address unlikely to collide with other runs or fixtures. */
export function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

/**
 * Signs up through Better Auth without opening the verification link, as
 * the web app does, and returns the user's id. Delete the user in
 * `afterAll` with `deleteUsersAndClose`.
 */
export async function signUpUnverified(
  app: INestApplication<App>,
  email: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .post("/api/auth/sign-up/email")
    .send({
      name: users[0].name,
      email,
      password: fixturePassword,
      callbackURL: "/verify-email",
    })
    .expect(200);
  // Better Auth's response body is untyped (`any`).
  const id: unknown = response.body?.user?.id;
  if (typeof id !== "string") throw new Error("Sign-up returned no user id.");
  return id;
}

/**
 * Signs up a new user through Better Auth and opens the link from its
 * verification email, which verifies and signs it in. Delete it in
 * `afterAll` with `deleteUsersAndClose`.
 */
export async function signUp(
  app: INestApplication<App>,
  label: string,
): Promise<TestUser> {
  const email = uniqueEmail(label);
  const id = await signUpUnverified(app, email);
  const response = await request(app.getHttpServer())
    .get(publisher.verificationLink(email))
    .expect(302);
  return { id, email, cookie: response.get("Set-Cookie") ?? [] };
}

/**
 * Deletes the users with `emails` and the organizations they belong to (a
 * personal one each). Their sessions, accounts, and memberships cascade.
 */
export async function deleteUsers(
  dataSource: DataSource,
  emails: string[],
): Promise<void> {
  const rows = await dataSource
    .getRepository(BaUser)
    .findBy({ email: In(emails) });
  if (rows.length === 0) return;
  const userIds = rows.map((user) => user.id);
  const memberships = await dataSource
    .getRepository(BaMember)
    .findBy({ userId: In(userIds) });
  if (memberships.length > 0) {
    await dataSource.getRepository(BaOrganization).delete({
      id: In(memberships.map((member) => member.organizationId)),
    });
  }
  await dataSource.getRepository(BaUser).delete({ id: In(userIds) });
}

/**
 * Deletes users made with `signUp` (see `deleteUsers`), then closes the
 * app. For `afterAll`, so it tolerates a failed `beforeAll`.
 */
export async function deleteUsersAndClose(
  app: INestApplication<App> | undefined,
  testUsers: (Pick<TestUser, "email"> | undefined)[],
): Promise<void> {
  if (app) {
    await deleteUsers(
      app.get(DataSource),
      testUsers.flatMap((user) => (user ? [user.email] : [])),
    );
  }
  await app?.close();
}
