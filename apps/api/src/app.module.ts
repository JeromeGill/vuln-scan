import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ORPCModule } from "@orpc/nest";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { DataSource } from "typeorm";
import { AccountModule } from "./account/account.module.js";
import { createAuth } from "./auth/auth.js";
import { databaseOptions } from "./database.js";
import { JobPublisher } from "./messaging/job-publisher.js";
import { MessagingModule } from "./messaging/messaging.module.js";
import { orpcConfig } from "./orpc.js";
import { ProjectsModule } from "./projects/projects.module.js";
import { UploadTokensModule } from "./upload-tokens/upload-tokens.module.js";
import { UploadsModule } from "./uploads/uploads.module.js";

@Module({
  imports: [
    TypeOrmModule.forRootAsync(databaseOptions),
    AuthModule.forRootAsync({
      imports: [MessagingModule],
      inject: [DataSource, JobPublisher],
      useFactory: (dataSource: DataSource, publisher: JobPublisher) => ({
        auth: createAuth(dataSource, publisher),
      }),
    }),
    ORPCModule.forRoot(orpcConfig),
    AccountModule,
    ProjectsModule,
    UploadTokensModule,
    UploadsModule,
  ],
})
export class AppModule {}
