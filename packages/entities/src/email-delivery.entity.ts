import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from "typeorm";
import { BaUser } from "./ba-user.entity.js";

export type EmailDeliveryStatus = "sending" | "sent";

/**
 * One row per email message the worker has sent or is sending, keyed by the
 * queue message id. The worker claims the row before sending, so a message
 * delivered twice is only emailed once.
 */
@Entity({ name: "email_delivery" })
export class EmailDelivery {
  /** The envelope `id` of the queue message. */
  @PrimaryColumn({ name: "message_id", type: "uuid" })
  messageId: string;

  /** Message `type`, e.g. `email.verify-email`. */
  @Column({ type: "text" })
  type: string;

  @Index()
  @Column({ name: "user_id", type: "text" })
  userId: string;

  @ManyToOne(() => BaUser, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: Relation<BaUser>;

  @Column({ type: "text" })
  recipient: string;

  /** `sending` while claimed, `sent` once the SMTP server accepted it. */
  @Column({ type: "text" })
  status: EmailDeliveryStatus;

  /** When the current claim was taken. */
  @Column({ name: "claimed_at", type: "timestamptz", default: () => "now()" })
  claimedAt: Date;

  @Column({ name: "sent_at", type: "timestamptz", nullable: true })
  sentAt: Date | null;
}
