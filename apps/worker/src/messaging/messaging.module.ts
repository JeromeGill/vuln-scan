import { Global, Module, type DynamicModule } from "@nestjs/common";
import {
  AmqpConnection,
  MESSAGING_OPTIONS,
  type MessagingOptions,
} from "./amqp-connection.js";
import { JobPublisher } from "./job-publisher.js";

/** RabbitMQ connection, `JobPublisher`, and consumers (`addConsumer`). */
@Global()
@Module({})
export class MessagingModule {
  static forRoot(options: MessagingOptions): DynamicModule {
    return {
      module: MessagingModule,
      providers: [
        { provide: MESSAGING_OPTIONS, useValue: options },
        AmqpConnection,
        JobPublisher,
      ],
      exports: [AmqpConnection, JobPublisher],
    };
  }
}
