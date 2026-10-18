import { Controller, Res } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { uploadTokensContract } from "@repo/contracts";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { activeOrganizationId } from "../auth/active-organization.js";
import { UploadTokensService } from "./upload-tokens.service.js";

@Controller()
export class UploadTokensController {
  constructor(private readonly service: UploadTokensService) {}

  @Implement(uploadTokensContract)
  // @Res() hands the response to oRPC: see orpc.ts.
  uploadTokens(@Session() session: UserSession, @Res() _res: unknown) {
    const organizationId = activeOrganizationId(session);
    return {
      list: implement(uploadTokensContract.list).handler(
        ({ input: { projectId, ...params } }) =>
          this.service.list(organizationId, projectId, params),
      ),
      create: implement(uploadTokensContract.create).handler(
        ({ input: { projectId, ...body } }) =>
          this.service.create(organizationId, projectId, session.user, body),
      ),
      revoke: implement(uploadTokensContract.revoke).handler(
        ({ input: { projectId, id } }) =>
          this.service.revoke(organizationId, projectId, id),
      ),
    };
  }
}
