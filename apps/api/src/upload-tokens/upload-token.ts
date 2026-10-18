import { createHash, randomBytes } from "node:crypto";

/** Every upload token starts with this, so secret scanners can spot leaks. */
export const uploadTokenPrefix = "vs_";

/** Random bytes in a token: 256 bits, so hashing needs no salt or stretching. */
const secretBytes = 32;

const dayMs = 24 * 60 * 60 * 1000;

/** A new upload token and what is stored of it. */
export interface GeneratedUploadToken {
  /** The full token, `vs_…`: returned once, never stored. */
  token: string;
  /** `hashUploadToken(token)`, stored to look the token up by. */
  hash: string;
  /** The token's last four characters, stored for display. */
  lastFour: string;
}

/** Generates a random upload token. */
export function generateUploadToken(): GeneratedUploadToken {
  const token = `${uploadTokenPrefix}${randomBytes(secretBytes).toString("base64url")}`;
  return { token, hash: hashUploadToken(token), lastFour: token.slice(-4) };
}

/**
 * The hex SHA-256 of `token`. A plain hash is enough (no salt or slow
 * hash): the token is random and long, so it can't be guessed from it.
 */
export function hashUploadToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * When a token created at `now` that lasts `expiresInDays` expires, or
 * `null` if it never does.
 */
export function uploadTokenExpiresAt(
  expiresInDays: number | null,
  now: Date,
): Date | null {
  return expiresInDays === null
    ? null
    : new Date(now.getTime() + expiresInDays * dayMs);
}
