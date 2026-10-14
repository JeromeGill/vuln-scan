/**
 * Object keys are opaque, `/`-separated paths such as
 * `issues/{issueId}/{photoId}/original`. They're restricted to a portable
 * subset so the same key is valid (and means the same object) for every
 * provider: no leading or trailing `/`, no empty, `.` or `..` segments, and
 * only letters, digits, `.`, `_`, `-` (plus `/` between segments).
 */
const SEGMENT = /^[A-Za-z0-9._-]+$/;
const MAX_KEY_LENGTH = 512;

export class InvalidKeyError extends Error {
  constructor(key: string, reason: string) {
    super(`Invalid storage key ${JSON.stringify(key)}: ${reason}.`);
    this.name = "InvalidKeyError";
  }
}

function segmentProblem(segment: string): string | undefined {
  if (segment === "") return "empty segment";
  if (segment === "." || segment === "..") return `"${segment}" segment`;
  if (!SEGMENT.test(segment)) return "unsupported character";
  return undefined;
}

/** Throws `InvalidKeyError` unless `key` is a valid object key. */
export function assertValidKey(key: string): void {
  if (typeof key !== "string" || key.length === 0) {
    throw new InvalidKeyError(String(key), "empty");
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new InvalidKeyError(key, `longer than ${MAX_KEY_LENGTH} characters`);
  }
  if (key.startsWith("/")) throw new InvalidKeyError(key, "leading /");
  for (const segment of key.split("/")) {
    const problem = segmentProblem(segment);
    if (problem) throw new InvalidKeyError(key, problem);
  }
}

/**
 * Throws unless `prefix` is a valid key prefix for `deletePrefix`: a valid
 * key, optionally ending with `/`. Empty prefixes are refused so a bug can't
 * delete everything.
 */
export function assertValidPrefix(prefix: string): void {
  if (typeof prefix !== "string" || prefix.length === 0) {
    throw new InvalidKeyError(String(prefix), "empty prefix");
  }
  assertValidKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix);
}
