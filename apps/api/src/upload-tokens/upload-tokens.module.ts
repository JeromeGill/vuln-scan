import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UploadToken } from "@repo/entities";
import { ProjectsModule } from "../projects/projects.module.js";
import { UploadTokensController } from "./upload-tokens.controller.js";
import { UploadTokensService } from "./upload-tokens.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([UploadToken]), ProjectsModule],
  controllers: [UploadTokensController],
  providers: [UploadTokensService],
})
export class UploadTokensModule {}
