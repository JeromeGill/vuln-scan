import {
  Inject,
  Injectable,
  Logger,
  type BeforeApplicationShutdown,
  type OnApplicationShutdown,
  type OnModuleInit,
} from "@nestjs/common";
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type Options,
  type RecoveringChannelModel,
} from "amqplib";
import { JobConsumer, type JobConsumerOptions } from "./job-consumer.js";
import { publishConfirmed } from "./publish.js";
import { declareTopology } from "./topology.js";

export const MESSAGING_OPTIONS = Symbol("MESSAGING_OPTIONS");

export interface MessagingOptions {
  url: string;
  retryDelaysMs: readonly number[];
  /** Unacked messages per consumer (default 10). */
  prefetch?: number;
}

/**
 * The worker's one RabbitMQ connection. amqplib reconnects with backoff when
 * it drops; after every (re)connect this declares the topology, opens the
 * publishing channel, and restarts the consumers.
 */
@Injectable()
export class AmqpConnection
  implements OnModuleInit, BeforeApplicationShutdown, OnApplicationShutdown
{
  private readonly logger = new Logger(AmqpConnection.name);
  private readonly consumers: JobConsumer[] = [];
  private connection?: RecoveringChannelModel;
  private model?: ChannelModel;
  private publishChannel?: ConfirmChannel;

  constructor(
    @Inject(MESSAGING_OPTIONS) private readonly options: MessagingOptions,
  ) {}

  async onModuleInit(): Promise<void> {
    this.connection = await connect(this.options.url, {
      recovery: {
        // Fail startup if the broker is unreachable; once connected, keep
        // reconnecting.
        initialMaxRetries: 5,
        maxRetries: Infinity,
        maxDelay: 10_000,
        setup: (model: ChannelModel) => this.setup(model),
      },
    });
    this.connection.on("disconnect", (error: Error) =>
      this.logger.warn(`Disconnected from RabbitMQ: ${error.message}`),
    );
    this.connection.on("error", (error: Error) =>
      this.logger.error(`RabbitMQ connection error: ${error.message}`),
    );
  }

  private async setup(model: ChannelModel): Promise<void> {
    const channel = await model.createConfirmChannel();
    channel.on("error", (error: Error) =>
      this.logger.error(`Publish channel error: ${error.message}`),
    );
    await declareTopology(channel, this.options.retryDelaysMs.length);
    this.publishChannel = channel;
    this.model = model;
    for (const consumer of this.consumers) await consumer.start(model);
    this.logger.log("Connected to RabbitMQ.");
  }

  /** Consumes a queue now and after every reconnect, until shutdown. */
  async addConsumer(
    options: Omit<JobConsumerOptions, "retryDelaysMs" | "prefetch">,
  ): Promise<void> {
    const consumer = new JobConsumer({
      retryDelaysMs: this.options.retryDelaysMs,
      prefetch: this.options.prefetch ?? 10,
      ...options,
    });
    this.consumers.push(consumer);
    if (this.model) await consumer.start(this.model);
  }

  /** Publishes and waits for the broker's confirmation. */
  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: Options.Publish,
  ): Promise<void> {
    if (!this.publishChannel) {
      throw new Error("Not connected to RabbitMQ.");
    }
    await publishConfirmed(
      this.publishChannel,
      exchange,
      routingKey,
      content,
      options,
    );
  }

  async beforeApplicationShutdown(): Promise<void> {
    await Promise.all(this.consumers.map((consumer) => consumer.stop()));
  }

  async onApplicationShutdown(): Promise<void> {
    await this.connection?.close().catch(() => undefined);
  }
}
