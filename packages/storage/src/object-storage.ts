import type { Readable } from "node:stream";

/** What can be stored: bytes in memory or a stream. */
export type ObjectBody = Buffer | Uint8Array | string | Readable;

export interface PutObjectOptions {
  /** MIME type stored with the object and served on download. */
  contentType: string;
}

export interface ObjectInfo {
  size: number;
  contentType: string;
}

export interface StoredObject extends ObjectInfo {
  /** The object's bytes. Consume or destroy it. */
  body: Readable;
}

export interface UploadUrlOptions {
  /** The upload must send exactly this `Content-Type`. */
  contentType: string;
  /** Uploads larger than this are rejected. */
  maxBytes: number;
  expiresInSeconds: number;
}

export interface DownloadUrlOptions {
  expiresInSeconds: number;
}

/**
 * A URL the browser (or anything else) can use without credentials, until
 * `expiresAt`. Send exactly `headers` with the request: a provider may sign
 * them.
 */
export interface SignedRequest {
  url: string;
  method: "PUT" | "GET";
  headers: Record<string, string>;
  expiresAt: Date;
}

export class ObjectNotFoundError extends Error {
  constructor(readonly key: string) {
    super(`No stored object with key ${JSON.stringify(key)}.`);
    this.name = "ObjectNotFoundError";
  }
}

/** Longest lifetime of a signed URL (7 days: GCS and S3 allow no more). */
export const MAX_SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Provider-neutral object storage, implemented by one driver per provider
 * (so far `gcs`, which also runs against the fake-gcs-server emulator
 * locally). Keys are validated by every method (see `keys.ts`). Also the
 * Nest injection token: inject `ObjectStorage` to get the driver
 * `STORAGE_DRIVER` selected.
 */
export abstract class ObjectStorage {
  /** The driver's name, e.g. `gcs`. */
  abstract readonly driver: string;

  /** Creates or replaces the object. */
  abstract putObject(
    key: string,
    body: ObjectBody,
    options: PutObjectOptions,
  ): Promise<void>;

  /** Opens the object for reading. Throws `ObjectNotFoundError`. */
  abstract getObject(key: string): Promise<StoredObject>;

  /** The object's size and type, or null if it doesn't exist. */
  abstract headObject(key: string): Promise<ObjectInfo | null>;

  /** Deletes the object; deleting a missing object is not an error. */
  abstract deleteObject(key: string): Promise<void>;

  /**
   * Deletes every object whose key starts with `prefix` (a plain string
   * prefix, as in GCS and S3: `issues/1` also matches `issues/10/…`, so end
   * it with `/` to mean a folder).
   */
  abstract deletePrefix(prefix: string): Promise<void>;

  /** A signed `PUT` URL that lets its holder upload this one object. */
  abstract createUploadUrl(
    key: string,
    options: UploadUrlOptions,
  ): Promise<SignedRequest>;

  /** A signed `GET` URL that lets its holder download this one object. */
  abstract createDownloadUrl(
    key: string,
    options: DownloadUrlOptions,
  ): Promise<SignedRequest>;
}

export function assertExpiry(expiresInSeconds: number): void {
  if (
    !Number.isInteger(expiresInSeconds) ||
    expiresInSeconds <= 0 ||
    expiresInSeconds > MAX_SIGNED_URL_SECONDS
  ) {
    throw new RangeError(
      `expiresInSeconds must be a whole number from 1 to ${MAX_SIGNED_URL_SECONDS}.`,
    );
  }
}

export function assertUploadOptions(options: UploadUrlOptions): void {
  assertExpiry(options.expiresInSeconds);
  if (!Number.isInteger(options.maxBytes) || options.maxBytes <= 0) {
    throw new RangeError("maxBytes must be a positive whole number.");
  }
  if (!isContentType(options.contentType)) {
    throw new RangeError(
      `Invalid content type ${JSON.stringify(options.contentType)}.`,
    );
  }
}

/** `type/subtype`, no parameters (they'd have to match byte for byte). */
export function isContentType(value: string): boolean {
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/i.test(
    value,
  );
}
