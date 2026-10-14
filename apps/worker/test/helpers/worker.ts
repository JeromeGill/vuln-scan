import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import { env } from "@repo/config/worker";
import { BaUser } from "@repo/entities";
import {
  createMessage,
  verifyEmail,
  type VerifyEmail,
  type VerifyEmailData,
} from "@repo/events";
import { users } from "@repo/fixtures";
import {
  connect,
  type Channel,
  type ChannelModel,
  type GetMessage,
} from "amqplib";
import { DataSource } from "typeorm";
import { MailerService, type Email } from "../../src/mail/mailer.service.js";
import { SmtpMailerService } from "../../src/mail/smtp-mailer.service.js";
import { WorkerModule } from "../../src/worker.module.js";

/** Boots the full `WorkerModule`, optionally with another mailer. */
export async function createWorker(
  options: { mailer?: MailerService } = {},
): Promise<TestingModule> {
  let builder = Test.createTestingModule({ imports: [WorkerModule] });
  if (options.mailer) {
    builder = builder.overrideProvider(MailerService).useValue(options.mailer);
  }
  const worker = await builder.compile();
  await worker.init();
  return worker;
}

/**
 * Sends through SMTP (Mailpit) unless told to fail for a recipient: always
 * (`failAlways`), for the first N attempts (`failTimes`), or with a given
 * error. Counts attempts per recipient.
 */
export class TestMailer extends MailerService {
  private readonly smtp = new SmtpMailerService();
  readonly attempts = new Map<string, number>();
  readonly failures = new Map<string, { times: number; error: () => Error }>();

  failFor(
    recipient: string,
    times = Infinity,
    error = () => new Error("Connection refused (simulated)"),
  ) {
    this.failures.set(recipient, { times, error });
  }

  async send(email: Email): Promise<void> {
    const attempt = (this.attempts.get(email.to) ?? 0) + 1;
    this.attempts.set(email.to, attempt);
    const failure = this.failures.get(email.to);
    if (failure && attempt <= failure.times) throw failure.error();
    await this.smtp.send(email);
  }

  close() {
    this.smtp.onApplicationShutdown();
  }
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

/**
 * Inserts a user directly, named like a fixture user. Test fixtures may write the Better Auth tables
 * for setup and teardown (the worker has no Better Auth instance). Delete it
 * with `deleteUsers`; deliveries cascade.
 */
export async function createUser(
  dataSource: DataSource,
  label: string,
): Promise<TestUser> {
  const id = `worker-test-${randomUUID()}`;
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { name } = users[0];
  await dataSource.getRepository(BaUser).insert({ id, email, name });
  return { id, email, name };
}

export async function deleteUsers(
  dataSource: DataSource,
  testUsers: TestUser[],
) {
  if (testUsers.length === 0) return;
  await dataSource
    .getRepository(BaUser)
    .delete(testUsers.map((user) => user.id));
}

/** A verification email job for `user`, with a link that expires in an hour. */
export function verifyEmailFor(
  user: TestUser,
  data: Partial<VerifyEmailData> = {},
): VerifyEmail {
  const url = new URL("/api/auth/verify-email", env.WEB_URL);
  url.searchParams.set("token", randomUUID());
  url.searchParams.set("callbackURL", "/verify-email");
  return createMessage(verifyEmail, {
    userId: user.id,
    email: user.email,
    name: user.name,
    url: url.href,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...data,
  });
}

/** Polls `check` until it returns a value other than undefined/false. */
export async function waitFor<T>(
  check: () => T | false | undefined | Promise<T | false | undefined>,
  { timeout = 10_000, interval = 100, what = "condition" } = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const result = await check();
    if (result !== undefined && result !== false) return result;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${what}.`);
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

/** A separate connection for inspecting queues (e.g. the parking queue). */
export class QueueInspector {
  private constructor(
    private readonly connection: ChannelModel,
    private readonly channel: Channel,
  ) {}

  static async open(): Promise<QueueInspector> {
    const connection = await connect(env.RABBITMQ_URL);
    return new QueueInspector(connection, await connection.createChannel());
  }

  async purge(queue: string) {
    await this.channel.purgeQueue(queue);
  }

  /** Takes (and acks) every message currently in `queue`. */
  async drain(queue: string): Promise<GetMessage[]> {
    const messages: GetMessage[] = [];
    for (;;) {
      const message = await this.channel.get(queue);
      if (!message) return messages;
      this.channel.ack(message);
      messages.push(message);
    }
  }

  async close() {
    await this.connection.close();
  }
}
