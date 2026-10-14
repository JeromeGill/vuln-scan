import { z } from "zod";

/** The signed-in user, as the app shows them. */
export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
});

export type AccountDto = z.infer<typeof accountSchema>;
