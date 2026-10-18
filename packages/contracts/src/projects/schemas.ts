import { z } from "zod";

/**
 * A project's name: 1–100 characters once trimmed. The messages are shown
 * under the web form's name field.
 */
export const projectNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(100, "Use at most 100 characters.");

/** One app the user deploys, owned by their organization. */
export const projectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/** Body of `POST /projects`. */
export const createProjectSchema = z.object({ name: projectNameSchema });

/** Body of `PATCH /projects/{id}`. */
export const renameProjectSchema = z.object({ name: projectNameSchema });

export type ProjectDto = z.infer<typeof projectSchema>;
export type CreateProject = z.infer<typeof createProjectSchema>;
export type RenameProject = z.infer<typeof renameProjectSchema>;
