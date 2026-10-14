import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EmailDelivery } from "@repo/entities";
import type { Envelope } from "@repo/events";
import { Repository } from "typeorm";
import {
  MailerService,
  PermanentMailError,
  type Email,
} from "../mail/mailer.service.js";
import { ParkJobError } from "../messaging/retry.js";

/**
 * After this long, a claim still `sending` belongs to an attempt that died
 * mid-send (well past the SMTP timeouts), so whether the email went out is
 * unknown.
 */
export const CLAIM_LEASE_MS = 10 * 60 * 1000;

type ClaimResult =
  /** This attempt owns the send. */
  | "claimed"
  /** Already sent: a duplicate delivery. */
  | "sent"
  /** Another attempt is sending it right now. */
  | "in-progress"
  /** An earlier attempt claimed it and never finished. */
  | "stale";

/**
 * Makes email delivery idempotent per queue message: a message is claimed
 * (a row inserted, keyed by its id) before the email is sent and marked sent
 * after, so a redelivered message never sends a second email.
 */
@Injectable()
export class EmailDeliveryService {
  constructor(
    @InjectRepository(EmailDelivery)
    private readonly deliveries: Repository<EmailDelivery>,
    private readonly mailer: MailerService,
  ) {}

  /**
   * Sends `email` for `message` unless an earlier delivery of the same
   * message already did; resolves to whether this call sent it. Throws to
   * be retried (another attempt is sending it, or the send failed), or a
   * `ParkJobError` when retrying can't help.
   */
  async sendOnce(
    message: Envelope,
    userId: string,
    email: Email,
  ): Promise<boolean> {
    const claim = await this.claim({
      messageId: message.id,
      type: message.type,
      userId,
      recipient: email.to,
    });
    switch (claim) {
      case "sent":
        return false;
      case "in-progress":
        // Retry later: the other attempt either finishes (then this is a
        // duplicate) or releases the claim.
        throw new Error("Another attempt is sending this message.");
      case "stale":
        throw new ParkJobError(
          "unknown-outcome",
          "An earlier attempt claimed this message and never finished; it may have been sent.",
        );
      case "claimed":
        break;
    }

    try {
      await this.mailer.send(email);
    } catch (error) {
      // Give up the claim, so a retry can claim it again.
      await this.deliveries.delete({
        messageId: message.id,
        status: "sending",
      });
      if (error instanceof PermanentMailError) {
        throw new ParkJobError("permanent-failure", error.message);
      }
      throw error;
    }
    await this.deliveries.update(
      { messageId: message.id },
      { status: "sent", sentAt: new Date() },
    );
    return true;
  }

  private async claim(delivery: {
    messageId: string;
    type: string;
    userId: string;
    recipient: string;
  }): Promise<ClaimResult> {
    const result = await this.deliveries
      .createQueryBuilder()
      .insert()
      .values({ ...delivery, status: "sending" })
      .orIgnore()
      .returning(["messageId"])
      .execute();
    const inserted: unknown[] = result.raw;
    if (inserted.length > 0) return "claimed";

    const existing = await this.deliveries.findOneBy({
      messageId: delivery.messageId,
    });
    // Released between the insert and this read: try again later.
    if (!existing) return "in-progress";
    if (existing.status === "sent") return "sent";
    return Date.now() - existing.claimedAt.getTime() > CLAIM_LEASE_MS
      ? "stale"
      : "in-progress";
  }
}
