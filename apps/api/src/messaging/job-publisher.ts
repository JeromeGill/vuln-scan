import { Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { env } from "@repo/config/api";
import {
  jobsExchange,
  type MessageDefinition,
  type MessageOf,
} from "@repo/events";
import { connect, type ChannelModel, type ConfirmChannel } from "amqplib";

interface Connection {
  model: ChannelModel;
  channel: ConfirmChannel;
}

/**
 * Publishes jobs to the jobs exchange for the worker (docs/messaging.md). A
 * publish-only version of the worker's: it connects on the first publish,
 * declares only the exchange (the worker declares its queues), and after a
 * connection or channel error connects again on the next publish.
 */
@Injectable()
export class JobPublisher implements OnApplicationShutdown {
  private readonly logger = new Logger(JobPublisher.name);
  private connection?: Promise<Connection>;

  /**
   * Validates `message` against its definition and publishes it as a
   * persistent JSON message, routed by its `type`. Resolves once the broker
   * has confirmed it.
   */
  async publish<Definition extends MessageDefinition>(
    definition: Definition,
    message: MessageOf<Definition>,
  ): Promise<void> {
    const body = definition.schema.parse(message);
    const { channel } = await this.connect();
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        jobsExchange.name,
        body.type,
        Buffer.from(JSON.stringify(body)),
        {
          persistent: true,
          contentType: "application/json",
          messageId: body.id,
          type: body.type,
          timestamp: Math.floor(Date.parse(body.occurredAt) / 1000),
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  private connect(): Promise<Connection> {
    this.connection ??= this.open().catch((error: unknown) => {
      this.connection = undefined;
      throw error;
    });
    return this.connection;
  }

  private async open(): Promise<Connection> {
    const model = await connect(env.RABBITMQ_URL);
    model.on("error", (error: Error) =>
      this.logger.error(`RabbitMQ connection error: ${error.message}`),
    );
    const channel = await model.createConfirmChannel();
    channel.on("error", (error: Error) =>
      this.logger.error(`Publish channel error: ${error.message}`),
    );
    // The channel closes with the connection, or alone after an error:
    // either way, the next publish connects again.
    channel.on("close", () => {
      this.connection = undefined;
      model.close().catch(() => undefined);
    });
    await channel.assertExchange(jobsExchange.name, jobsExchange.type, {
      durable: true,
    });
    return { model, channel };
  }

  async onApplicationShutdown(): Promise<void> {
    const connection = await this.connection?.catch(() => undefined);
    await connection?.model.close().catch(() => undefined);
  }
}
