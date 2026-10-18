import { createHash } from "node:crypto";
import {
  generateUploadToken,
  hashUploadToken,
  uploadTokenExpiresAt,
  uploadTokenPrefix,
} from "./upload-token.js";

describe("generateUploadToken", () => {
  it("starts the token with vs_ followed by 43 url-safe characters", () => {
    const { token } = generateUploadToken();
    expect(uploadTokenPrefix).toBe("vs_");
    expect(token).toMatch(/^vs_[A-Za-z0-9_-]{43}$/);
  });

  it("returns the token's SHA-256 hash and last four characters", () => {
    const { token, hash, lastFour } = generateUploadToken();
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(lastFour).toBe(token.slice(-4));
    expect(lastFour).toHaveLength(4);
  });

  it("generates a different token every time", () => {
    const tokens = new Set(
      Array.from({ length: 100 }, () => generateUploadToken().token),
    );
    expect(tokens.size).toBe(100);
  });
});

describe("hashUploadToken", () => {
  it("is the hex SHA-256 of the token", () => {
    expect(hashUploadToken("vs_example")).toBe(
      createHash("sha256").update("vs_example").digest("hex"),
    );
    expect(hashUploadToken("vs_example")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives the same hash for the same token and different ones otherwise", () => {
    expect(hashUploadToken("vs_a")).toBe(hashUploadToken("vs_a"));
    expect(hashUploadToken("vs_a")).not.toBe(hashUploadToken("vs_b"));
  });
});

describe("uploadTokenExpiresAt", () => {
  const now = new Date("2026-10-18T12:34:56.789Z");

  it("is null for a token that never expires", () => {
    expect(uploadTokenExpiresAt(null, now)).toBeNull();
  });

  it.each([
    [30, "2026-11-17T12:34:56.789Z"],
    [90, "2027-01-16T12:34:56.789Z"],
    [365, "2027-10-18T12:34:56.789Z"],
  ])("is %i days after now", (days, expected) => {
    expect(uploadTokenExpiresAt(days, now)).toEqual(new Date(expected));
  });
});
