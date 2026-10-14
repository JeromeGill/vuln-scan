import { describe, expect, it } from "vitest";
import { assertValidKey, assertValidPrefix, InvalidKeyError } from "./keys.js";

describe("storage keys", () => {
  it.each([
    "a",
    "issues/0b6c6e2a-5d0e-4f5e-9d6a-1f2e3d4c5b6a/p1/original",
    "issues/1/p1/thumb-400.webp",
    "a.b_c-D/E",
    "..a/b..",
  ])("accepts %j", (key) => {
    expect(() => assertValidKey(key)).not.toThrow();
  });

  it.each([
    "",
    "/a",
    "a/",
    "a//b",
    "a/./b",
    "a/../b",
    "a b",
    "a\\b",
    "é",
    "x".repeat(513),
  ])("rejects %j", (key) => {
    expect(() => assertValidKey(key)).toThrow(InvalidKeyError);
  });

  it.each(["issues/1/", "issues/1"])("accepts the prefix %j", (prefix) => {
    expect(() => assertValidPrefix(prefix)).not.toThrow();
  });

  it.each(["", "/", "issues//", "../x/"])("rejects the prefix %j", (prefix) => {
    expect(() => assertValidPrefix(prefix)).toThrow(InvalidKeyError);
  });
});
