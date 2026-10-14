import { z } from "zod";

/** Mailpit's HTTP API (docker compose publishes it on 8025). */
const MAILPIT_URL = "http://localhost:8025/api/v1";

const addressSchema = z.object({ Address: z.string(), Name: z.string() });

const summarySchema = z.object({
  ID: z.string(),
  Subject: z.string(),
  To: z.array(addressSchema),
});
export type MailpitSummary = z.infer<typeof summarySchema>;

const messageSchema = summarySchema.extend({
  From: addressSchema,
  Text: z.string(),
  HTML: z.string(),
});
export type MailpitMessage = z.infer<typeof messageSchema>;

/** Fetches `path` and parses the response with `schema`. */
async function get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Mailpit GET ${path}: ${response.status}`);
  }
  return schema.parse(await response.json());
}

/** Messages addressed to `address`, newest first. */
export async function messagesTo(address: string): Promise<MailpitSummary[]> {
  const query = encodeURIComponent(`to:"${address}"`);
  const { messages } = await get(
    `/search?query=${query}`,
    z.object({ messages: z.array(summarySchema) }),
  );
  return messages;
}

/** One message; `Text` has `\n` line endings (SMTP uses `\r\n`). */
export async function message(id: string): Promise<MailpitMessage> {
  const found = await get(`/message/${id}`, messageSchema);
  return { ...found, Text: found.Text.replaceAll("\r\n", "\n") };
}

export function headers(id: string): Promise<Record<string, string[]>> {
  return get(
    `/message/${id}/headers`,
    z.record(z.string(), z.array(z.string())),
  );
}
