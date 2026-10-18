import type { TestingModule } from "@nestjs/testing";
import { EmailDelivery } from "@repo/entities";
import { verifyEmail, type VerifyEmail } from "@repo/events";
import { DataSource } from "typeorm";
import { VerifyEmailHandler } from "../../src/email/verify-email.handler.js";
import { JobPublisher } from "../../src/messaging/job-publisher.js";
import { message, messagesTo } from "../helpers/mailpit.js";
import {
  createUser,
  createWorker,
  deleteUsers,
  TestMailer,
  verifyEmailFor,
  waitFor,
  type TestUser,
} from "../helpers/worker.js";

describe("Verification email (integration)", () => {
  let worker: TestingModule;
  let dataSource: DataSource;
  let publisher: JobPublisher;
  const mailer = new TestMailer();
  const users: TestUser[] = [];
  /** Envelope ids of messages the handler completed (sent or skipped). */
  const handled: string[] = [];

  const newUser = async (label: string) => {
    const user = await createUser(dataSource, label);
    users.push(user);
    return user;
  };

  const handledCount = (id: string) => handled.filter((h) => h === id).length;

  beforeAll(async () => {
    worker = await createWorker({ mailer });
    dataSource = worker.get(DataSource);
    publisher = worker.get(JobPublisher);

    // Record each message the handler completes without throwing.
    const handler = worker.get(VerifyEmailHandler);
    const handle = handler.handle.bind(handler);
    handler.handle = async (job: VerifyEmail) => {
      await handle(job);
      handled.push(job.id);
    };
  });

  afterAll(async () => {
    await deleteUsers(dataSource, users);
    await worker?.close();
    mailer.close();
  });

  it("emails the verification link", async () => {
    const user = await newUser("verify");
    const job = verifyEmailFor(user);
    await publisher.publish(verifyEmail, job);

    const summary = await waitFor(
      async () => (await messagesTo(user.email))[0],
      { what: "the email" },
    );
    const email = await message(summary.ID);
    expect(email.Subject).toBe("Verify your email for vulnscan");
    expect(email.Text).toContain(job.data.url);
    expect(email.Text).toContain("The link expires in an hour.");
    expect(email.HTML).toContain(
      `href="${job.data.url.replaceAll("&", "&amp;")}"`,
    );
    expect(
      await dataSource
        .getRepository(EmailDelivery)
        .findOneByOrFail({ messageId: job.id }),
    ).toMatchObject({ status: "sent", type: verifyEmail.type });
  });

  it("skips a job whose link has expired", async () => {
    const user = await newUser("verify-expired");
    const job = verifyEmailFor(user, {
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    await publisher.publish(verifyEmail, job);

    await waitFor(() => handledCount(job.id) === 1, { what: "the delivery" });
    expect(mailer.attempts.has(user.email)).toBe(false);
    expect(await messagesTo(user.email)).toHaveLength(0);
  });

  it("sends one email when the same message is delivered twice", async () => {
    const user = await newUser("verify-duplicate");
    const job = verifyEmailFor(user);
    await publisher.publish(verifyEmail, job);
    await publisher.publish(verifyEmail, job);

    await waitFor(() => handledCount(job.id) === 2, {
      what: "both deliveries",
    });
    expect(mailer.attempts.get(user.email)).toBe(1);
    expect(await messagesTo(user.email)).toHaveLength(1);
  });
});
