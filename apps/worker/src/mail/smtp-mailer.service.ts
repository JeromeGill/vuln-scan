import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { env } from "@repo/config/worker";
import { createTransport } from "nodemailer";
import {
  MailerService,
  PermanentMailError,
  type Email,
} from "./mailer.service.js";

/**
 * Sends through any SMTP server (`SMTP_URL`): Mailpit locally, a provider in
 * production.
 */
@Injectable()
export class SmtpMailerService
  extends MailerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(SmtpMailerService.name);
  private readonly transport = createTransport(
    {
      url: env.SMTP_URL,
      // Fail fast so a hung server becomes a retry, not a stuck consumer.
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    },
    { from: env.MAIL_FROM },
  );

  /**
   * Logs whether the server accepts the connection and credentials, so a
   * wrong `SMTP_URL` shows up when the worker starts rather than at the next
   * send. Doesn't block startup or fail it: a server that's down for a while
   * only delays emails (sends are retried).
   */
  onApplicationBootstrap(): void {
    // Never the whole URL: it holds the password.
    const server = new URL(env.SMTP_URL).host;
    void this.transport.verify().then(
      () => this.logger.log(`SMTP server ${server} accepted the connection.`),
      (error: unknown) =>
        this.logger.error(
          `SMTP server ${server} check failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
    );
  }

  async send(email: Email): Promise<void> {
    try {
      await this.transport.sendMail(email);
    } catch (error) {
      // 5xx replies are permanent (e.g. unknown mailbox); 4xx and network
      // errors are worth retrying.
      const code =
        error instanceof Error && "responseCode" in error
          ? error.responseCode
          : undefined;
      if (typeof code === "number" && code >= 500) {
        throw new PermanentMailError(
          `SMTP server refused the message (${code}).`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  onApplicationShutdown(): void {
    this.transport.close();
  }
}
