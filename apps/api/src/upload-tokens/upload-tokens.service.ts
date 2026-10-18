import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ORPCError } from "@orpc/nest";
import type {
  CreatedUploadTokenDto,
  CreateUploadToken,
  ListUploadTokensParams,
  Page,
  UploadTokenDto,
} from "@repo/contracts";
import { UploadToken } from "@repo/entities";
import { type FindOptionsWhere, IsNull, Repository } from "typeorm";
import { ProjectsService } from "../projects/projects.service.js";
import { generateUploadToken, uploadTokenExpiresAt } from "./upload-token.js";

/** Who creates a token: the session's user. */
export interface TokenCreator {
  id: string;
  name: string;
}

/**
 * The upload tokens of an organization's projects. Every method takes the
 * organization's and the project's ids; a project of another organization
 * is `NOT_FOUND`, as is a token of another project or a revoked one.
 */
@Injectable()
export class UploadTokensService {
  constructor(
    @InjectRepository(UploadToken)
    private readonly tokens: Repository<UploadToken>,
    private readonly projects: ProjectsService,
  ) {}

  /** A page of the project's tokens that aren't revoked, newest first. */
  async list(
    organizationId: string,
    projectId: string,
    { limit, offset }: ListUploadTokensParams,
  ): Promise<Page<UploadTokenDto>> {
    await this.projects.get(organizationId, projectId);
    const [rows, total] = await this.tokens
      .createQueryBuilder("token")
      .leftJoinAndSelect("token.createdBy", "createdBy")
      .where({
        projectId,
        revokedAt: IsNull(),
      } satisfies FindOptionsWhere<UploadToken>)
      .orderBy("token.createdAt", "DESC")
      .addOrderBy("token.id", "DESC")
      .take(limit)
      .skip(offset)
      .getManyAndCount();
    return {
      items: rows.map((token) => toDto(token, token.createdBy ?? null)),
      total,
    };
  }

  /**
   * Creates a token for the project. The response holds the full token,
   * which is stored only as a hash and so can't be returned again.
   */
  async create(
    organizationId: string,
    projectId: string,
    creator: TokenCreator,
    { name, expiresInDays }: CreateUploadToken,
  ): Promise<CreatedUploadTokenDto> {
    await this.projects.get(organizationId, projectId);
    const { token, hash, lastFour } = generateUploadToken();
    const saved = await this.tokens.save(
      this.tokens.create({
        projectId,
        name,
        tokenHash: hash,
        lastFour,
        createdById: creator.id,
        expiresAt: uploadTokenExpiresAt(expiresInDays, new Date()),
      }),
    );
    return { ...toDto(saved, creator), token };
  }

  /** Revokes the token: it stops working and leaves the list. */
  async revoke(
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<void> {
    await this.projects.get(organizationId, projectId);
    const { affected } = await this.tokens
      .createQueryBuilder()
      .update(UploadToken)
      .set({ revokedAt: new Date() })
      .where({
        id,
        projectId,
        revokedAt: IsNull(),
      } satisfies FindOptionsWhere<UploadToken>)
      .execute();
    if (!affected)
      throw new ORPCError("NOT_FOUND", { message: "Upload token not found." });
  }
}

/** The token as the api shows it: no hash, and its creator's name. */
function toDto(
  token: UploadToken,
  creator: TokenCreator | null,
): UploadTokenDto {
  return {
    id: token.id,
    name: token.name,
    lastFour: token.lastFour,
    createdBy: creator ? { id: creator.id, name: creator.name } : null,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    expiresAt: token.expiresAt,
  };
}
