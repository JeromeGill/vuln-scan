import { z } from "zod";
import { defineMessage, type MessageOf } from "../envelope.js";

export const verifyEmailDataSchema = z.object({
  /** `auth.user` id of the recipient. */
  userId: z.string().min(1),
  email: z.email(),
  name: z.string(),
  /** The verification link. */
  url: z.url(),
  /** When the link stops working; the email isn't sent after that. */
  expiresAt: z.iso.datetime({ offset: true }),
});

/**
 * The link that verifies an account's email address.
 */
export const verifyEmail = defineMessage(
  "email.verify-email",
  1,
  verifyEmailDataSchema,
);

export type VerifyEmail = MessageOf<typeof verifyEmail>;
export type VerifyEmailData = z.infer<typeof verifyEmailDataSchema>;
