import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UploadToken } from "@repo/entities";
import { StorageModule } from "../storage/storage.module.js";
import { UploadTokenGuard } from "./upload-token.guard.js";
import { UploadsController } from "./uploads.controller.js";
import { UploadsService } from "./uploads.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([UploadToken]), StorageModule],
  controllers: [UploadsController],
  providers: [UploadsService, UploadTokenGuard],
})
export class UploadsModule {}
