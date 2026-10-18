import type { UploadTokenDto, UploadTokenExpiry } from "@repo/contracts";
import { formatDate } from "@/lib/format";

/**
 * The expiries a new token can have, in the order the form lists them.
 * `value` is the Select's (which only takes strings).
 */
export const expiryOptions = [
  { value: "never", days: null, label: "Never" },
  { value: "30", days: 30, label: "30 days" },
  { value: "90", days: 90, label: "90 days" },
  { value: "365", days: 365, label: "365 days" },
] as const satisfies readonly {
  value: string;
  days: UploadTokenExpiry;
  label: string;
}[];

/** The option for `days`. */
export function expiryOption(days: UploadTokenExpiry) {
  return (
    expiryOptions.find((option) => option.days === days) ?? expiryOptions[0]
  );
}

/** Whether `token` had expired at `now`. */
export function isExpired(
  token: Pick<UploadTokenDto, "expiresAt">,
  now: Date,
): boolean {
  return token.expiresAt !== null && token.expiresAt <= now;
}

/** "Never expires", "Expires Oct 1, 2027", or "Expired Oct 1, 2026". */
export function describeExpiry(
  token: Pick<UploadTokenDto, "expiresAt">,
  now: Date,
): string {
  if (token.expiresAt === null) return "Never expires";
  return `${isExpired(token, now) ? "Expired" : "Expires"} ${formatDate(token.expiresAt)}`;
}

/** "Last used Oct 1, 2026", or "Never used". */
export function describeLastUsed(
  token: Pick<UploadTokenDto, "lastUsedAt">,
): string {
  return token.lastUsedAt
    ? `Last used ${formatDate(token.lastUsedAt)}`
    : "Never used";
}
