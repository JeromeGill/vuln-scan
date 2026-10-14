import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { env } from "@repo/config/worker";
import { databaseOptions } from "./database.js";
import { EmailModule } from "./email/email.module.js";
import { MessagingModule } from "./messaging/messaging.module.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync(databaseOptions),
    MessagingModule.forRoot({
      url: env.RABBITMQ_URL,
      retryDelaysMs: env.JOB_RETRY_DELAYS_MS,
    }),
    EmailModule,
  ],
})
export class WorkerModule {}
