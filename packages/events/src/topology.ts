/**
 * Broker topology shared by every producer and consumer, in any language
 * (also emitted as `dist/schemas/topology.json`). Declarations are
 * idempotent, but RabbitMQ rejects a redeclaration whose arguments differ, so
 * everyone must use exactly these. See docs/messaging.md.
 */

/** Producers publish every job here, with the message `type` as routing key. */
export const jobsExchange = { name: "app.jobs", type: "topic" } as const;

export interface JobQueue {
  /** Work queue name; also the prefix of its retry and parking queues. */
  name: string;
  /** Routing keys (topic patterns) bound to the queue. */
  bindings: readonly string[];
}

/** Outgoing email: every `email.*` message type. */
export const emailQueue = {
  name: "email",
  bindings: ["email.#"],
} as const satisfies JobQueue;

export const jobQueues: readonly JobQueue[] = [emailQueue];

/** Holds a failed message for its `retry`-th retry (1-based) until it expires. */
export function retryQueueName(queue: string, retry: number): string {
  return `${queue}.retry.${retry}`;
}

/** Messages that won't be retried, kept for inspection. */
export function parkedQueueName(queue: string): string {
  return `${queue}.parked`;
}

/**
 * Broker-side redelivery limit: a message whose consumer keeps crashing or
 * disconnecting before it acks is parked after this many deliveries.
 */
export const deliveryLimit = 5;

type QueueArguments = Record<string, string | number>;

export const queueArguments = {
  work: (queue: string): QueueArguments => ({
    "x-queue-type": "quorum",
    "x-delivery-limit": deliveryLimit,
    "x-dead-letter-exchange": "",
    "x-dead-letter-routing-key": parkedQueueName(queue),
  }),
  /** Expired messages go back to the work queue. */
  retry: (queue: string): QueueArguments => ({
    "x-queue-type": "quorum",
    "x-dead-letter-exchange": "",
    "x-dead-letter-routing-key": queue,
  }),
  parked: (): QueueArguments => ({ "x-queue-type": "quorum" }),
};

/** AMQP headers the consumers set. */
export const jobHeaders = {
  /** Retries so far (absent on the first attempt). */
  retryCount: "retry-count",
  /** Why a message was parked; one of `parkedReasons`. */
  parkedReason: "parked-reason",
  /** The last error message, on retried and parked messages. */
  lastError: "last-error",
} as const;

export const parkedReasons = [
  /** The body isn't JSON, or isn't a valid envelope. */
  "invalid-message",
  /** No handler for this `type` and `version`. */
  "unknown-type",
  /** `data` doesn't match the message type's schema. */
  "invalid-data",
  /** The handler reported an error that retrying won't fix. */
  "permanent-failure",
  /** Still failing after the last retry. */
  "retries-exhausted",
  /** A previous attempt may have done the work; needs a human. */
  "unknown-outcome",
] as const;

export type ParkedReason = (typeof parkedReasons)[number];
