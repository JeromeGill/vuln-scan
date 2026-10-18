import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { ORPCError } from "@orpc/nest";
import {
  maxLockfileBytes,
  type UploadedLockfileDto,
  type UploadLockfile,
} from "@repo/contracts";
import { Environment, Lockfile, Release, UploadToken } from "@repo/entities";
import { ObjectStorage } from "@repo/storage";
import { DataSource, type EntityManager, type FindOptionsWhere } from "typeorm";
import { lockfileStorageKey } from "../storage/keys.js";

/** Lockfiles are text; they're stored as such whatever the client sent. */
const lockfileContentType = "text/plain";

/**
 * Stores lockfiles uploaded with a project's upload token, creating the
 * environment and release they belong to on first use.
 */
@Injectable()
export class UploadsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // Missing (or `null`) without STORAGE_DRIVER.
    // An explicit token: the union type hides the class from Nest.
    @Optional()
    @Inject(ObjectStorage)
    private readonly storage?: ObjectStorage | null,
  ) {}

  async upload(
    token: UploadToken,
    { environment: name, version, path, file }: UploadLockfile,
  ): Promise<UploadedLockfileDto> {
    const storage = this.storage;
    if (!storage) {
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        message: "Uploads aren't available: no file storage is set up.",
      });
    }
    if (file.size > maxLockfileBytes) {
      throw new ORPCError("PAYLOAD_TOO_LARGE", {
        message: "Upload a file of at most 20 MB.",
      });
    }
    const body = Buffer.from(await file.arrayBuffer());

    // One transaction, with the file stored before it commits: a failed
    // write to storage leaves no rows behind.
    const live = await this.dataSource.transaction(async (manager) => {
      const environment = await lockEnvironment(manager, token.projectId, name);
      const release = await releaseOf(manager, environment, version);
      const lockfile = await lockfileAt(manager, environment, release, path, {
        size: body.length,
        sha256: createHash("sha256").update(body).digest("hex"),
      });
      await storage.putObject(lockfile.storageKey, body, {
        contentType: lockfileContentType,
      });
      return environment.liveReleaseId === release.id;
    });

    await this.dataSource
      .createQueryBuilder()
      .update(UploadToken)
      .set({ lastUsedAt: new Date() })
      .where({ id: token.id } satisfies FindOptionsWhere<UploadToken>)
      .execute();

    return { environment: name, version, path, live };
  }
}

/**
 * The project's environment named `name`, created if it's new, and locked
 * until the transaction ends, so concurrent uploads to it create each
 * release once.
 */
async function lockEnvironment(
  manager: EntityManager,
  projectId: string,
  name: string,
): Promise<Environment> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(Environment)
    .values({ projectId, name })
    .orIgnore()
    .execute();
  return manager
    .createQueryBuilder(Environment, "environment")
    .setLock("pessimistic_write")
    .where({ projectId, name } satisfies FindOptionsWhere<Environment>)
    .getOneOrFail();
}

/**
 * The environment's release of `version`. A new one is created and made
 * live (updating `environment`).
 */
async function releaseOf(
  manager: EntityManager,
  environment: Environment,
  version: string,
): Promise<Release> {
  const existing = await manager
    .createQueryBuilder(Release, "release")
    .where({
      environmentId: environment.id,
      version,
    } satisfies FindOptionsWhere<Release>)
    .getOne();
  if (existing) return existing;

  const release = await manager.save(
    manager.create(Release, { environmentId: environment.id, version }),
  );
  await manager
    .createQueryBuilder()
    .update(Environment)
    .set({ liveReleaseId: release.id })
    .where({ id: environment.id } satisfies FindOptionsWhere<Environment>)
    .execute();
  environment.liveReleaseId = release.id;
  return release;
}

/**
 * The release's lockfile at `path` with `file`'s size and hash: the
 * existing row (whose stored file the upload replaces) or a new one.
 */
async function lockfileAt(
  manager: EntityManager,
  environment: Environment,
  release: Release,
  path: string,
  file: Pick<Lockfile, "size" | "sha256">,
): Promise<Lockfile> {
  const existing = await manager
    .createQueryBuilder(Lockfile, "lockfile")
    .where({ releaseId: release.id, path } satisfies FindOptionsWhere<Lockfile>)
    .getOne();
  if (existing) {
    return manager.save(Object.assign(existing, file));
  }
  const id = randomUUID();
  return manager.save(
    manager.create(Lockfile, {
      id,
      releaseId: release.id,
      path,
      ...file,
      storageKey: lockfileStorageKey({
        projectId: environment.projectId,
        environmentId: environment.id,
        releaseId: release.id,
        lockfileId: id,
      }),
    }),
  );
}
