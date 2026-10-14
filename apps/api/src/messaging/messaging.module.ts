import { Module } from "@nestjs/common";
import { JobPublisher } from "./job-publisher.js";

/** Publishes jobs to RabbitMQ (`JobPublisher`). */
@Module({
  providers: [JobPublisher],
  exports: [JobPublisher],
})
export class MessagingModule {}
