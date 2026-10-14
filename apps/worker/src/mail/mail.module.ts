import { Module } from "@nestjs/common";
import { MailerService } from "./mailer.service.js";
import { SmtpMailerService } from "./smtp-mailer.service.js";

@Module({
  providers: [{ provide: MailerService, useClass: SmtpMailerService }],
  exports: [MailerService],
})
export class MailModule {}
