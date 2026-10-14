import { Logger } from "@nestjs/common";
import {
  envelopeSchema,
  jobHeaders,
  parkedQueueName,
  type JobQueue,
  type ParkedReason,
} from "@repo/events";
import type { ChannelModel, ConfirmChannel, ConsumeMessage } from "amqplib";
import { z } from "zod";
import type { JobHandler } from "./job-handler.js";
import { publishConfirmed } from "./publish.js";
import {
  errorSummary,
  nextStep,
  ParkJobError,
  republishHeaders,
  retryCountOf,
} from "./retry.js";

export interface JobConsumerOptions {
  queue: JobQueue;
  handlers: readonly JobHandler[];
  retryDelaysMs: readonly number[];
  /** Unacked messages in flight at once. */
  prefetch: number;
}

/**
 * Consumes one work queue: validates each message, dispatches it to the
 * handler for its `type` and `version`, and acks it. A failed message is
 * republished to the next retry queue (it returns to the work queue when its
 * delay expires) or, after the last retry or for an invalid message, to the
 * parking queue; the original is acked only once that publish is confirmed.
 */
export class JobConsumer {
  private readonly logger: Logger;
  private readonly handlers = new Map<string, JobHandler>();
  private readonly inFlight = new Set<Promise<void>>();
  private channel?: ConfirmChannel;
  private consumerTag?: string;

  constructor(private readonly options: JobConsumerOptions) {
    this.logger = new Logger(`JobConsumer(${options.queue.name})`);
    for (const handler of options.handlers) {
      this.handlers.set(
        key(handler.message.type, handler.message.version),
        handler,
      );
    }
  }

  /** Starts consuming on a new channel of `model` (after each reconnect). */
  async start(model: ChannelModel): Promise<void> {
    const channel = await model.createConfirmChannel();
    channel.on("error", (error: Error) =>
      this.logger.error(`Channel error: ${error.message}`),
    );
    await channel.prefetch(this.options.prefetch);
    const { consumerTag } = await channel.consume(
      this.options.queue.name,
      (message) => {
        // null: the broker cancelled the consumer (e.g. queue deleted).
        if (!message) return;
        const work = this.process(channel, message).finally(() =>
          this.inFlight.delete(work),
        );
        this.inFlight.add(work);
      },
    );
    this.channel = channel;
    this.consumerTag = consumerTag;
  }

  /** Stops taking new messages and waits for those in flight. */
  async stop(): Promise<void> {
    const { channel, consumerTag } = this;
    this.channel = undefined;
    this.consumerTag = undefined;
    if (channel && consumerTag) {
      await channel.cancel(consumerTag).catch(() => undefined);
    }
    await Promise.allSettled(this.inFlight);
    await channel?.close().catch(() => undefined);
  }

  private async process(
    channel: ConfirmChannel,
    message: ConsumeMessage,
  ): Promise<void> {
    try {
      await this.dispatch(message);
      settle(() => channel.ack(message));
    } catch (error) {
      try {
        await this.handleFailure(channel, message, error);
        settle(() => channel.ack(message));
      } catch (publishError) {
        // Couldn't move it aside: put it back. The queue's delivery limit
        // parks it if this keeps happening.
        this.logger.error(
          `Couldn't retry or park ${describe(message)}: ${errorSummary(publishError)}`,
        );
        settle(() => channel.nack(message, false, true));
      }
    }
  }

  private async dispatch(message: ConsumeMessage): Promise<void> {
    let body: unknown;
    try {
      body = JSON.parse(message.content.toString("utf8"));
    } catch {
      throw new ParkJobError("invalid-message", "The body isn't JSON.");
    }

    const envelope = envelopeSchema.safeParse(body);
    if (!envelope.success) {
      throw new ParkJobError(
        "invalid-message",
        z.prettifyError(envelope.error),
      );
    }

    const { type, version } = envelope.data;
    const handler = this.handlers.get(key(type, version));
    if (!handler) {
      throw new ParkJobError(
        "unknown-type",
        `No handler for ${type} version ${version}.`,
      );
    }

    const parsed = handler.message.schema.safeParse(body);
    if (!parsed.success) {
      throw new ParkJobError("invalid-data", z.prettifyError(parsed.error));
    }
    await handler.handle(parsed.data);
  }

  private async handleFailure(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    error: unknown,
  ): Promise<void> {
    const summary = errorSummary(error);
    if (error instanceof ParkJobError) {
      return this.park(channel, message, error.reason, summary);
    }

    const step = nextStep(
      this.options.queue.name,
      retryCountOf(message.properties.headers),
      this.options.retryDelaysMs,
    );
    if (step.kind === "park") {
      return this.park(channel, message, step.reason, summary);
    }

    this.logger.warn(
      `${describe(message)} failed (${summary}); retry ${step.retry} in ${step.delayMs} ms.`,
    );
    await publishConfirmed(channel, "", step.queue, message.content, {
      ...publishProperties(message),
      expiration: String(step.delayMs),
      headers: republishHeaders(message.properties.headers, {
        [jobHeaders.retryCount]: step.retry,
        [jobHeaders.lastError]: summary,
      }),
    });
  }

  private async park(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    reason: ParkedReason,
    summary: string,
  ): Promise<void> {
    this.logger.error(`Parking ${describe(message)} (${reason}): ${summary}`);
    await publishConfirmed(
      channel,
      "",
      parkedQueueName(this.options.queue.name),
      message.content,
      {
        ...publishProperties(message),
        headers: republishHeaders(message.properties.headers, {
          [jobHeaders.parkedReason]: reason,
          [jobHeaders.lastError]: summary,
        }),
      },
    );
  }
}

function key(type: string, version: number) {
  return `${type}@${version}`;
}

function describe(message: ConsumeMessage) {
  const { type, messageId } = message.properties;
  return `message ${messageId ?? "(no id)"} (${type ?? "no type"})`;
}

/** The original's properties, kept on retried and parked copies. */
function publishProperties({ properties }: ConsumeMessage) {
  return {
    persistent: true,
    contentType: properties.contentType,
    messageId: properties.messageId,
    type: properties.type,
    timestamp: properties.timestamp,
  };
}

/**
 * Acks and nacks fail if the channel closed meanwhile (e.g. a reconnect);
 * the broker then redelivers the message, so there's nothing else to do.
 */
function settle(action: () => void) {
  try {
    action();
  } catch {
    // Channel closed.
  }
}
