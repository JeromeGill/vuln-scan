import { randomUUID } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { beforeAll, describe, expect, it } from "vitest";
import { createObjectStorage } from "../src/create.js";
import { InvalidKeyError } from "../src/keys.js";
import {
  ObjectNotFoundError,
  type ObjectStorage,
} from "../src/object-storage.js";

/** fake-gcs-server from docker-compose.yml. */
const EMULATOR_URL = "http://localhost:4443";

// The emulator accepts signed URLs without checking their signature or the
// size-range header, so these tests prove the driver's calls and the URLs'
// shape, not that Google would accept the signature (see docs/storage.md).
describe("gcs driver (fake-gcs-server)", () => {
  let storage: ObjectStorage;
  // A fresh prefix per run, so runs don't see each other's objects.
  const root = `test-${randomUUID()}`;
  const key = (name: string) => `${root}/${name}`;

  beforeAll(async () => {
    storage = await createObjectStorage({
      driver: "gcs",
      bucket: "vulnscan-storage-test",
      apiEndpoint: EMULATOR_URL,
    });
  });

  it("stores, describes, reads, and deletes an object", async () => {
    await storage.putObject(key("a.txt"), "hello", {
      contentType: "text/plain",
    });
    expect(await storage.headObject(key("a.txt"))).toEqual({
      size: 5,
      contentType: "text/plain",
    });
    const object = await storage.getObject(key("a.txt"));
    expect((await buffer(object.body)).toString()).toBe("hello");

    await storage.deleteObject(key("a.txt"));
    expect(await storage.headObject(key("a.txt"))).toBeNull();
    await expect(storage.getObject(key("a.txt"))).rejects.toBeInstanceOf(
      ObjectNotFoundError,
    );
    // Deleting a missing object is fine.
    await storage.deleteObject(key("a.txt"));
  });

  it("deletes by prefix, as a plain string prefix", async () => {
    for (const name of ["p/1", "p/2", "p10/1", "q/1"]) {
      await storage.putObject(key(name), name, { contentType: "text/plain" });
    }
    await storage.deletePrefix(key("p/"));
    expect(await storage.headObject(key("p/1"))).toBeNull();
    expect(await storage.headObject(key("p/2"))).toBeNull();
    expect(await storage.headObject(key("p10/1"))).not.toBeNull();
    expect(await storage.headObject(key("q/1"))).not.toBeNull();
  });

  it("uploads and downloads through signed URLs", async () => {
    const upload = await storage.createUploadUrl(key("photo.jpg"), {
      contentType: "image/jpeg",
      maxBytes: 1000,
      expiresInSeconds: 900,
    });
    expect(upload.method).toBe("PUT");
    expect(new URL(upload.url).searchParams.get("X-Goog-Algorithm")).toBe(
      "GOOG4-RSA-SHA256",
    );
    const put = await fetch(upload.url, {
      method: "PUT",
      headers: upload.headers,
      body: Buffer.from("jpeg bytes"),
    });
    expect(put.ok).toBe(true);
    expect(await storage.headObject(key("photo.jpg"))).toEqual({
      size: 10,
      contentType: "image/jpeg",
    });

    const download = await storage.createDownloadUrl(key("photo.jpg"), {
      expiresInSeconds: 60,
    });
    const get = await fetch(download.url, { headers: download.headers });
    expect(get.ok).toBe(true);
    expect(await get.text()).toBe("jpeg bytes");
  });

  it("refuses invalid keys and options", async () => {
    for (const bad of ["", "/a", "a/", "a//b", "a/../b", "a b"]) {
      await expect(storage.headObject(bad)).rejects.toBeInstanceOf(
        InvalidKeyError,
      );
    }
    await expect(storage.deletePrefix("")).rejects.toBeInstanceOf(
      InvalidKeyError,
    );
    await expect(
      storage.createUploadUrl(key("x"), {
        contentType: "image/jpeg; charset=x",
        maxBytes: 10,
        expiresInSeconds: 60,
      }),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      storage.createDownloadUrl(key("x"), { expiresInSeconds: 0 }),
    ).rejects.toBeInstanceOf(RangeError);
  });
});
