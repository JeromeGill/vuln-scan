import {
  errorSummary,
  nextStep,
  republishHeaders,
  retryCountOf,
} from "./retry.js";

describe("retryCountOf", () => {
  it("is 0 on the first delivery", () => {
    expect(retryCountOf(undefined)).toBe(0);
    expect(retryCountOf({})).toBe(0);
  });

  it("reads the retry-count header", () => {
    expect(retryCountOf({ "retry-count": 2 })).toBe(2);
    expect(retryCountOf({ "retry-count": "3" })).toBe(3);
  });

  it("treats an invalid header as 0", () => {
    expect(retryCountOf({ "retry-count": "lots" })).toBe(0);
    expect(retryCountOf({ "retry-count": -1 })).toBe(0);
    expect(retryCountOf({ "retry-count": 1.5 })).toBe(0);
  });
});

describe("nextStep", () => {
  const delays = [100, 1000, 5000];

  it("retries with the delay for each attempt", () => {
    expect(nextStep("email", 0, delays)).toEqual({
      kind: "retry",
      retry: 1,
      queue: "email.retry.1",
      delayMs: 100,
    });
    expect(nextStep("email", 2, delays)).toEqual({
      kind: "retry",
      retry: 3,
      queue: "email.retry.3",
      delayMs: 5000,
    });
  });

  it("parks once every retry is used", () => {
    expect(nextStep("email", 3, delays)).toEqual({
      kind: "park",
      reason: "retries-exhausted",
    });
    expect(nextStep("email", 0, [])).toEqual({
      kind: "park",
      reason: "retries-exhausted",
    });
  });
});

describe("republishHeaders", () => {
  it("drops broker headers and applies changes", () => {
    expect(
      republishHeaders(
        { "x-death": [{}], "x-delivery-count": 2, "retry-count": 1, a: "b" },
        { "retry-count": 2 },
      ),
    ).toEqual({ "retry-count": 2, a: "b" });
  });
});

describe("errorSummary", () => {
  it("truncates long messages", () => {
    expect(errorSummary(new Error("x".repeat(600)))).toHaveLength(500);
    expect(errorSummary("plain")).toBe("plain");
  });
});
