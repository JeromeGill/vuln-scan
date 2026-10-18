import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Environment, Lockfile } from "@repo/entities";
import { ProjectsModule } from "../projects/projects.module.js";
import { EnvironmentsController } from "./environments.controller.js";
import { EnvironmentsService } from "./environments.service.js";

@Module({
  imports: [TypeOrmModule.forFeature([Environment, Lockfile]), ProjectsModule],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
})
export class EnvironmentsModule {}
