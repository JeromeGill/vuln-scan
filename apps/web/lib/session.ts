import "server-only";
import { env } from "@repo/config/web";
import { headers } from "next/headers";
import { z } from "zod";

/** The parts of Better Auth's session the app uses; `null` when signed out. */
const sessionSchema = z
  .object({ user: z.object({ name: z.string(), email: z.string() }) })
  .nullable();

/**
 * Reads the Better Auth session for the current request by forwarding its
 * cookie to the api. Server components only.
 */
export async function getSession(): Promise<z.infer<typeof sessionSchema>> {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;

  const response = await fetch(`${env.API_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return sessionSchema.parse(await response.json());
}
