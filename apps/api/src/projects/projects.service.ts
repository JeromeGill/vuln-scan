import { Inject, Injectable, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ORPCError } from "@orpc/nest";
import type {
  CreateProject,
  ListProjectsParams,
  Page,
  RenameProject,
} from "@repo/contracts";
import { Project } from "@repo/entities";
import { ObjectStorage } from "@repo/storage";
import { type FindOptionsWhere, Repository } from "typeorm";
import { isUniqueViolation } from "../database-errors.js";
import { projectStoragePrefix } from "../storage/keys.js";

/**
 * The projects of one organization. Every method takes the organization's
 * id, and a project of another organization is `NOT_FOUND`.
 */
@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
    // Missing (or `null`) without STORAGE_DRIVER.
    // An explicit token: the union type hides the class from Nest.
    @Optional()
    @Inject(ObjectStorage)
    private readonly storage?: ObjectStorage | null,
  ) {}

  /** A page of the organization's projects, newest first. */
  async list(
    organizationId: string,
    { limit, offset }: ListProjectsParams,
  ): Promise<Page<Project>> {
    const [items, total] = await this.projects
      .createQueryBuilder("project")
      .where({ organizationId } satisfies FindOptionsWhere<Project>)
      .orderBy("project.createdAt", "DESC")
      .addOrderBy("project.id", "DESC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return { items, total };
  }

  async create(
    organizationId: string,
    { name }: CreateProject,
  ): Promise<Project> {
    try {
      return await this.projects.save(
        this.projects.create({ organizationId, name }),
      );
    } catch (error) {
      throw nameConflict(error);
    }
  }

  async get(organizationId: string, id: string): Promise<Project> {
    const project = await this.projects.findOneBy({ id, organizationId });
    if (!project)
      throw new ORPCError("NOT_FOUND", { message: "Project not found." });
    return project;
  }

  async rename(
    organizationId: string,
    id: string,
    { name }: RenameProject,
  ): Promise<Project> {
    const project = await this.get(organizationId, id);
    project.name = name;
    try {
      return await this.projects.save(project);
    } catch (error) {
      throw nameConflict(error);
    }
  }

  /**
   * Deletes the project with everything in it: its rows cascade, and its
   * stored files (lockfiles) are deleted first, so a failure there leaves
   * the project to delete again rather than files nothing points to.
   */
  async delete(organizationId: string, id: string): Promise<void> {
    await this.get(organizationId, id);
    await this.storage?.deletePrefix(projectStoragePrefix(id));
    const { affected } = await this.projects.delete({ id, organizationId });
    if (!affected)
      throw new ORPCError("NOT_FOUND", { message: "Project not found." });
  }
}

/** A `CONFLICT` for a name the organization already uses, else `error`. */
function nameConflict(error: unknown): unknown {
  return isUniqueViolation(error)
    ? new ORPCError("CONFLICT", {
        message: "A project with this name already exists.",
      })
    : error;
}
