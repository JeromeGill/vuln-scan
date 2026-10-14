import type { ConfirmChannel, Options } from "amqplib";

/** Publishes and resolves once the broker has confirmed the message. */
export function publishConfirmed(
  channel: ConfirmChannel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  options: Options.Publish,
): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.publish(exchange, routingKey, content, options, (error) =>
      error ? reject(error) : resolve(),
    );
  });
}
