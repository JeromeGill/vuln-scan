import { z } from "zod";

/**
 * An upload token's name: 1–100 characters once trimmed. The messages are
 * shown under the web form's name field.
 */
export const uploadTokenNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(100, "Use at most 100 characters.");

/** How long a new upload token lasts, in days; `null` never expires. */
export const uploadTokenExpirySchema = z.literal([30, 90, 365]).nullable();

/**
 * An upload token as listed: never the token itself, only its last four
 * characters.
 */
export const uploadTokenSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  lastFour: z.string(),
  /** Who created it; `null` once that user's account is deleted. */
  createdBy: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.coerce.date(),
  /** `null` until the token is first used to upload. */
  lastUsedAt: z.coerce.date().nullable(),
  /** `null` for a token that never expires. */
  expiresAt: z.coerce.date().nullable(),
});

/**
 * Response of `POST /projects/{projectId}/upload-tokens`: the new token, with
 * the full `token` (`vs_…`), which no other response contains.
 */
export const createdUploadTokenSchema = uploadTokenSchema.extend({
  token: z.string().startsWith("vs_"),
});

/** Body of `POST /projects/{projectId}/upload-tokens`. */
export const createUploadTokenSchema = z.object({
  name: uploadTokenNameSchema,
  expiresInDays: uploadTokenExpirySchema,
});

export type UploadTokenDto = z.infer<typeof uploadTokenSchema>;
export type CreatedUploadTokenDto = z.infer<typeof createdUploadTokenSchema>;
export type CreateUploadToken = z.infer<typeof createUploadTokenSchema>;
export type UploadTokenExpiry = z.infer<typeof uploadTokenExpirySchema>;
