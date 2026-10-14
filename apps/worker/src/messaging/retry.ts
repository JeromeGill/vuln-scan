import { jobHeaders, retryQueueName, type ParkedReason } from "@repo/events";

/**
 * Thrown by a job handler (or the consumer) when retrying can't help: the
 * message goes straight to the parking queue.
 */
export class ParkJobError extends Error {
  constructor(
    readonly reason: ParkedReason,
    message: string,
  ) {
    super(message);
    this.name = "ParkJobError";
  }
}

/** Retries so far, from the `retry-count` header (0 if absent or invalid). */
export function retryCountOf(
  headers: Record<string, unknown> | undefined,
): number {
  const value = Number(headers?.[jobHeaders.retryCount] ?? 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export type FailureStep =
  | { kind: "retry"; retry: number; queue: string; delayMs: number }
  | { kind: "park"; reason: ParkedReason };

/**
 * What to do with a message whose handler failed for the `retryCount + 1`-th
 * time: wait in the next retry queue, or park it once every delay is used.
 */
export function nextStep(
  queue: string,
  retryCount: number,
  retryDelaysMs: readonly number[],
): FailureStep {
  const delayMs = retryDelaysMs[retryCount];
  if (delayMs === undefined) {
    return { kind: "park", reason: "retries-exhausted" };
  }
  const retry = retryCount + 1;
  return { kind: "retry", retry, queue: retryQueueName(queue, retry), delayMs };
}

/**
 * Headers for a republished message: ours, without the ones the broker adds
 * (`x-death`, `x-delivery-count`, …), which publishers may not set.
 */
export function republishHeaders(
  headers: Record<string, unknown> | undefined,
  changes: Record<string, string | number>,
): Record<string, unknown> {
  const kept = Object.entries(headers ?? {}).filter(
    ([name]) => !name.startsWith("x-"),
  );
  return { ...Object.fromEntries(kept), ...changes };
}

/** Header values stay small. */
export function errorSummary(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 500 ? `${message.slice(0, 497)}...` : message;
}
