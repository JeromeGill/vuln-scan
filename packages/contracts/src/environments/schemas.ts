import { z } from "zod";

/**
 * An environment of a project as listed: its name and the release that is
 * live in it.
 */
export const environmentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  /** `null` only while the environment's first upload is being stored. */
  liveRelease: z
    .object({
      version: z.string(),
      /**
       * When a file of the release was last uploaded (adding or replacing
       * one updates it).
       */
      uploadedAt: z.coerce.date(),
    })
    .nullable(),
});

export type EnvironmentDto = z.infer<typeof environmentSchema>;
