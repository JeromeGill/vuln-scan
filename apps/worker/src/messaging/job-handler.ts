import type { MessageDefinition, MessageOf } from "@repo/events";

/**
 * Handles one message type and version. Resolve to ack; throw to retry
 * (with backoff, then park), or throw `ParkJobError` to park at once.
 * Messages can be delivered more than once, so handlers must be idempotent.
 */
export interface JobHandler<Definition extends MessageDefinition = any> {
  readonly message: Definition;
  handle(message: MessageOf<Definition>): Promise<void>;
}
