import { base } from "../base.js";
import { uploadedLockfileSchema, uploadLockfileSchema } from "./schemas.js";

export const uploadsPath = "/uploads";

/**
 * Uploads from CI, authenticated with a project's upload token
 * (`Authorization: Bearer vs_…`) rather than a session: a missing,
 * unknown, revoked or expired token is `UNAUTHORIZED`.
 */
export const uploadsContract = base
  .prefix(uploadsPath)
  .tag("Uploads")
  .router({
    /**
     * Stores a lockfile in the token's project. The first upload with an
     * environment name creates the environment; one with a new version
     * creates its release and makes it live; one with a known version adds
     * the file to that release (or replaces the file at that path) and
     * leaves the live release alone.
     */
    create: base
      .route({ method: "POST", path: "/", successStatus: 201 })
      .errors({
        PAYLOAD_TOO_LARGE: {
          status: 413,
          message: "Upload a file of at most 20 MB.",
        },
        SERVICE_UNAVAILABLE: {
          status: 503,
          message: "Uploads aren't available right now.",
        },
      })
      .input(uploadLockfileSchema)
      .output(uploadedLockfileSchema),
  });
