import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  PayloadTooLargeException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { maxLockfileBytes } from "@repo/contracts";
import { UploadToken } from "@repo/entities";
import type { Request } from "express";
import { type FindOptionsWhere, IsNull, Repository } from "typeorm";
import {
  hashUploadToken,
  uploadTokenPrefix,
} from "../upload-tokens/upload-token.js";

/**
 * Room for the multipart body's other parts (the fields, boundaries and
 * part headers) next to a file of the largest size.
 */
const multipartOverheadBytes = 64 * 1024;

/** The token each request was authenticated with, set by the guard. */
const tokens = new WeakMap<Request, UploadToken>();

/**
 * An error body in oRPC's shape, so clients get the same JSON from the
 * guard as from the route.
 */
function orpcError(code: string, status: number, message: string) {
  return { defined: true, code, status, message };
}

/**
 * Authenticates an upload with a project's upload token
 * (`Authorization: Bearer vs_…`), in place of a session: a missing,
 * unknown, revoked or expired token is a 401 before the body is read. Then
 * refuses a body whose `Content-Length` is too large for any allowed file
 * with a 413, also before reading it (the route checks the file's own
 * size).
 */
@Injectable()
export class UploadTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(UploadToken)
    private readonly uploadTokens: Repository<UploadToken>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Nest types the request as `any`.
    const request: Request = context.switchToHttp().getRequest();
    const token = await this.authenticate(request.headers.authorization);
    const length = Number(request.headers["content-length"]);
    if (length > maxLockfileBytes + multipartOverheadBytes) {
      throw new PayloadTooLargeException(
        orpcError("PAYLOAD_TOO_LARGE", 413, "Upload a file of at most 20 MB."),
      );
    }
    tokens.set(request, token);
    return true;
  }

  private async authenticate(
    authorization: string | undefined,
  ): Promise<UploadToken> {
    const secret = /^Bearer (\S+)$/.exec(authorization ?? "")?.[1];
    if (!secret?.startsWith(uploadTokenPrefix)) {
      throw unauthorized(
        "Send an upload token: Authorization: Bearer vs_… (create one on the project's page).",
      );
    }
    const token = await this.uploadTokens
      .createQueryBuilder("token")
      .where({
        tokenHash: hashUploadToken(secret),
        revokedAt: IsNull(),
      } satisfies FindOptionsWhere<UploadToken>)
      .getOne();
    if (!token) {
      throw unauthorized("This upload token isn't valid, or was revoked.");
    }
    if (token.expiresAt && token.expiresAt <= new Date()) {
      throw unauthorized("This upload token has expired.");
    }
    return token;
  }
}

function unauthorized(message: string) {
  return new UnauthorizedException(orpcError("UNAUTHORIZED", 401, message));
}

/** The upload token `UploadTokenGuard` authenticated the request with. */
export const CurrentUploadToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UploadToken => {
    // Nest types the request as `any`.
    const request: Request = context.switchToHttp().getRequest();
    const token = tokens.get(request);
    if (!token) throw new Error("UploadTokenGuard didn't run.");
    return token;
  },
);
