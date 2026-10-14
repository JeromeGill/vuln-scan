import { expect } from "@playwright/test";
import { z } from "zod";

/** Mailpit's HTTP API (docker compose publishes it on 8025). */
const MAILPIT_URL = "http://localhost:8025/api/v1";

async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`);
  if (!response.ok) throw new Error(`Mailpit GET ${path}: ${response.status}`);
  return schema.parse(await response.json());
}

/**
 * The text of the newest email to `address` whose subject contains
 * `subject`, waiting for one to arrive.
 */
export async function waitForEmailTo(
  address: string,
  subject: string,
): Promise<string> {
  const query = encodeURIComponent(`to:"${address}" subject:"${subject}"`);
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const { messages } = await get(
          `/search?query=${query}`,
          z.object({ messages: z.array(z.object({ ID: z.string() })) }),
        );
        id = messages[0]?.ID;
        return id;
      },
      { message: `an email to ${address}`, timeout: 30_000 },
    )
    .toBeDefined();
  if (!id) throw new Error(`No email to ${address}.`);
  const { Text } = await get(`/message/${id}`, z.object({ Text: z.string() }));
  return Text;
}

/** The link in the newest verification email to `address`. */
export async function verificationLink(address: string): Promise<string> {
  const text = await waitForEmailTo(address, "Verify your email for My App");
  const link = /(http\S+\/api\/auth\/verify-email\?\S+)/.exec(text)?.[1];
  if (!link)
    throw new Error(`No verification link in the email to ${address}.`);
  return link;
}
