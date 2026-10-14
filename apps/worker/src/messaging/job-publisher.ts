import { Injectable } from "@nestjs/common";
import {
  jobsExchange,
  type MessageDefinition,
  type MessageOf,
} from "@repo/events";
import { AmqpConnection } from "./amqp-connection.js";

/** Publishes jobs to the jobs exchange, routed by their message `type`. */
@Injectable()
export class JobPublisher {
  constructor(private readonly amqp: AmqpConnection) {}

  /**
   * Validates `message` against its definition and publishes it as a
   * persistent JSON message. Resolves once the broker has confirmed it.
   */
  async publish<Definition extends MessageDefinition>(
    definition: Definition,
    message: MessageOf<Definition>,
  ): Promise<void> {
    const body = definition.schema.parse(message);
    await this.amqp.publish(
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
    );
  }
}
