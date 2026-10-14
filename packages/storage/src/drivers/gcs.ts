import { generateKeyPairSync } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { ApiError, Storage, type Bucket } from "@google-cloud/storage";
import { assertValidKey, assertValidPrefix } from "../keys.js";
import {
  assertExpiry,
  assertUploadOptions,
  ObjectNotFoundError,
  ObjectStorage,
  type DownloadUrlOptions,
  type ObjectBody,
  type ObjectInfo,
  type PutObjectOptions,
  type SignedRequest,
  type StoredObject,
  type UploadUrlOptions,
} from "../object-storage.js";

export interface GcsStorageOptions {
  /** `GCS_BUCKET`. */
  bucket: string;
  /** `GCS_PROJECT_ID`; detected from the credentials when unset. */
  projectId?: string;
  /** A service account key file; Application Default Credentials when unset. */
  keyFile?: string;
  /**
   * A service account key's `client_email` and `private_key`, for hosts
   * where a key file is awkward (environment variables only). Takes
   * precedence over `keyFile`.
   */
  credentials?: { client_email: string; private_key: string };
  /**
   * `GCS_API_ENDPOINT`: an emulator (fake-gcs-server) instead of Google.
   * The driver then creates the bucket if it's missing and signs URLs with
   * a throwaway key, since the emulator checks neither credentials nor
   * signatures.
   */
  apiEndpoint?: string;
}

/** Signed header that makes GCS reject uploads outside the size range. */
export const CONTENT_LENGTH_RANGE_HEADER = "x-goog-content-length-range";

/**
 * Google Cloud Storage (or the fake-gcs-server emulator), through
 * `@google-cloud/storage`. Signed URLs are V4, signed by the client library:
 * with a key file's private key, or through the IAM `signBlob` API when
 * running with Application Default Credentials of a service account.
 */
export class GcsObjectStorage extends ObjectStorage {
  readonly driver = "gcs";

  private constructor(private readonly bucket: Bucket) {
    super();
  }

  static async create(options: GcsStorageOptions): Promise<GcsObjectStorage> {
    const emulator = options.apiEndpoint !== undefined;
    const client = new Storage({
      projectId: options.projectId ?? (emulator ? "emulator" : undefined),
      keyFilename: options.keyFile,
      apiEndpoint: options.apiEndpoint,
      credentials: emulator ? throwawayCredentials() : options.credentials,
    });
    const bucket = client.bucket(options.bucket);
    if (emulator) {
      const [exists] = await bucket.exists();
      if (!exists) await bucket.create();
    }
    return new GcsObjectStorage(bucket);
  }

  async putObject(
    key: string,
    body: ObjectBody,
    options: PutObjectOptions,
  ): Promise<void> {
    assertValidKey(key);
    const file = this.bucket.file(key);
    // Single-request uploads: objects are photos (MBs), for which a
    // resumable session's extra round trip isn't worth it.
    const writeOptions = { contentType: options.contentType, resumable: false };
    if (typeof body === "string" || body instanceof Uint8Array) {
      await file.save(Buffer.from(body), writeOptions);
    } else {
      await pipeline(body, file.createWriteStream(writeOptions));
    }
  }

  async getObject(key: string): Promise<StoredObject> {
    assertValidKey(key);
    const metadata = await this.metadata(key);
    if (!metadata) throw new ObjectNotFoundError(key);
    // Read the generation the metadata describes, so a replacement in
    // between can't mix one object's size and type with another's bytes.
    const body = this.bucket
      .file(key, { generation: metadata.generation })
      .createReadStream();
    return { body, size: metadata.size, contentType: metadata.contentType };
  }

  async headObject(key: string): Promise<ObjectInfo | null> {
    assertValidKey(key);
    const metadata = await this.metadata(key);
    return metadata
      ? { size: metadata.size, contentType: metadata.contentType }
      : null;
  }

  async deleteObject(key: string): Promise<void> {
    assertValidKey(key);
    await this.bucket.file(key).delete({ ignoreNotFound: true });
  }

  async deletePrefix(prefix: string): Promise<void> {
    assertValidPrefix(prefix);
    // Pages through the matches and deletes them with limited concurrency.
    await this.bucket.deleteFiles({ prefix, force: true });
  }

  async createUploadUrl(
    key: string,
    options: UploadUrlOptions,
  ): Promise<SignedRequest> {
    assertValidKey(key);
    assertUploadOptions(options);
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    const range = `0,${options.maxBytes}`;
    const [url] = await this.bucket.file(key).getSignedUrl({
      version: "v4",
      action: "write",
      expires: expiresAt,
      contentType: options.contentType,
      extensionHeaders: { [CONTENT_LENGTH_RANGE_HEADER]: range },
    });
    return {
      url,
      method: "PUT",
      headers: {
        "Content-Type": options.contentType,
        [CONTENT_LENGTH_RANGE_HEADER]: range,
      },
      expiresAt,
    };
  }

  async createDownloadUrl(
    key: string,
    options: DownloadUrlOptions,
  ): Promise<SignedRequest> {
    assertValidKey(key);
    assertExpiry(options.expiresInSeconds);
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    const [url] = await this.bucket.file(key).getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAt,
    });
    return { url, method: "GET", headers: {}, expiresAt };
  }

  private async metadata(key: string) {
    try {
      const [metadata] = await this.bucket.file(key).getMetadata();
      return {
        generation: metadata.generation,
        size: Number(metadata.size ?? 0),
        contentType: metadata.contentType ?? "application/octet-stream",
      };
    } catch (error) {
      if (error instanceof ApiError && error.code === 404) return null;
      throw error;
    }
  }
}

/** A made-up service account for signing URLs the emulator never checks. */
function throwawayCredentials() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    client_email: "app@emulator.iam.gserviceaccount.com",
    private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}
