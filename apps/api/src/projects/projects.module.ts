import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Project } from "@repo/entities";
import { StorageModule } from "../storage/storage.module.js";
import { ProjectsController } from "./projects.controller.js";
import { ProjectsService } from "./projects.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Project]), StorageModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  // For the resources under a project, to check it's the organization's.
  exports: [ProjectsService],
})
export class ProjectsModule {}
