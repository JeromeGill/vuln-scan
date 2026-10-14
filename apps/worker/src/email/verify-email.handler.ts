import { Injectable, Logger } from "@nestjs/common";
import { verifyEmail, type VerifyEmail } from "@repo/events";
import type { JobHandler } from "../messaging/job-handler.js";
import { EmailDeliveryService } from "./email-delivery.service.js";
import { renderVerifyEmail } from "./templates/verify-email.js";

/** Sends an email verification link. */
@Injectable()
export class VerifyEmailHandler implements JobHandler<typeof verifyEmail> {
  readonly message = verifyEmail;
  private readonly logger = new Logger(VerifyEmailHandler.name);

  constructor(private readonly deliveries: EmailDeliveryService) {}

  async handle(message: VerifyEmail): Promise<void> {
    const { userId, expiresAt } = message.data;

    // A retry after the link expired would only send a dead link; the user
    // asks for a new one instead.
    if (new Date(expiresAt).getTime() <= Date.now()) {
      this.logger.log(`Skipping ${message.id}: the link expired.`);
      return;
    }

    const email = await renderVerifyEmail(message.data);
    if (await this.deliveries.sendOnce(message, userId, email)) {
      this.logger.log(`Sent ${message.id} to user ${userId}.`);
    } else {
      this.logger.log(`Skipping ${message.id}: already sent.`);
    }
  }
}
