import {
  jobQueues,
  jobsExchange,
  parkedQueueName,
  queueArguments,
  retryQueueName,
  type JobQueue,
} from "@repo/events";
import type { Channel } from "amqplib";

/**
 * Declares the exchange and, for each queue, its work, retry, and parking
 * queues. Idempotent: run on every (re)connect by producers and consumers.
 */
export async function declareTopology(
  channel: Channel,
  retries: number,
  queues: readonly JobQueue[] = jobQueues,
): Promise<void> {
  await channel.assertExchange(jobsExchange.name, jobsExchange.type, {
    durable: true,
  });

  for (const queue of queues) {
    await channel.assertQueue(parkedQueueName(queue.name), {
      durable: true,
      arguments: queueArguments.parked(),
    });
    await channel.assertQueue(queue.name, {
      durable: true,
      arguments: queueArguments.work(queue.name),
    });
    for (const binding of queue.bindings) {
      await channel.bindQueue(queue.name, jobsExchange.name, binding);
    }
    for (let retry = 1; retry <= retries; retry++) {
      await channel.assertQueue(retryQueueName(queue.name, retry), {
        durable: true,
        arguments: queueArguments.retry(queue.name),
      });
    }
  }
}
