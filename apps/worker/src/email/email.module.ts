import { Module, type OnApplicationBootstrap } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { EmailDelivery } from "@repo/entities";
import { emailQueue } from "@repo/events";
import { MailModule } from "../mail/mail.module.js";
import { AmqpConnection } from "../messaging/amqp-connection.js";
import { EmailDeliveryService } from "./email-delivery.service.js";
import { VerifyEmailHandler } from "./verify-email.handler.js";

/** Consumes the `email` queue. */
@Module({
  imports: [TypeOrmModule.forFeature([EmailDelivery]), MailModule],
  providers: [EmailDeliveryService, VerifyEmailHandler],
})
export class EmailModule implements OnApplicationBootstrap {
  constructor(
    private readonly amqp: AmqpConnection,
    private readonly verifyEmail: VerifyEmailHandler,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.amqp.addConsumer({
      queue: emailQueue,
      handlers: [this.verifyEmail],
    });
  }
}
