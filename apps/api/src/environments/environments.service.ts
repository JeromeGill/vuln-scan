import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type {
  EnvironmentDto,
  ListEnvironmentsParams,
  Page,
} from "@repo/contracts";
import { Environment, Lockfile } from "@repo/entities";
import { type FindOptionsWhere, In, Repository } from "typeorm";
import { ProjectsService } from "../projects/projects.service.js";

/**
 * The environments of an organization's projects, which uploads create.
 * A project of another organization is `NOT_FOUND`.
 */
@Injectable()
export class EnvironmentsService {
  constructor(
    @InjectRepository(Environment)
    private readonly environments: Repository<Environment>,
    @InjectRepository(Lockfile)
    private readonly lockfiles: Repository<Lockfile>,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * A page of the project's environments by name, each with its live
   * release and when a file of that release was last uploaded.
   */
  async list(
    organizationId: string,
    projectId: string,
    { limit, offset }: ListEnvironmentsParams,
  ): Promise<Page<EnvironmentDto>> {
    await this.projects.get(organizationId, projectId);
    const [rows, total] = await this.environments
      .createQueryBuilder("environment")
      .leftJoinAndSelect("environment.liveRelease", "liveRelease")
      .where({ projectId } satisfies FindOptionsWhere<Environment>)
      .orderBy("environment.name", "ASC")
      .addOrderBy("environment.id", "ASC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    // A second query rather than joining the lockfiles above, which would
    // make TypeORM paginate with an extra DISTINCT query.
    const releaseIds = rows.flatMap(({ liveReleaseId }) =>
      liveReleaseId ? [liveReleaseId] : [],
    );
    const lastUploads = new Map<string, Date>();
    if (releaseIds.length > 0) {
      const files = await this.lockfiles
        .createQueryBuilder("lockfile")
        .select(["lockfile.id", "lockfile.releaseId", "lockfile.updatedAt"])
        .where({
          releaseId: In(releaseIds),
        } satisfies FindOptionsWhere<Lockfile>)
        .getMany();
      for (const { releaseId, updatedAt } of files) {
        const last = lastUploads.get(releaseId);
        if (!last || updatedAt > last) lastUploads.set(releaseId, updatedAt);
      }
    }

    return {
      items: rows.map(({ id, name, liveRelease }) => ({
        id,
        name,
        liveRelease: liveRelease
          ? {
              version: liveRelease.version,
              uploadedAt:
                lastUploads.get(liveRelease.id) ?? liveRelease.createdAt,
            }
          : null,
      })),
      total,
    };
  }
}
