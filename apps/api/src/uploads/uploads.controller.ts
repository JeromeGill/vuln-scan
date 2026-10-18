import { Controller, Res, UseGuards } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { uploadsContract } from "@repo/contracts";
import type { UploadToken } from "@repo/entities";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { CurrentUploadToken, UploadTokenGuard } from "./upload-token.guard.js";
import { UploadsService } from "./uploads.service.js";

@Controller()
export class UploadsController {
  constructor(private readonly service: UploadsService) {}

  @Implement(uploadsContract)
  // CI has no session: the upload token stands in for it.
  @AllowAnonymous()
  @UseGuards(UploadTokenGuard)
  // @Res() hands the response to oRPC: see orpc.ts.
  uploads(@CurrentUploadToken() token: UploadToken, @Res() _res: unknown) {
    return {
      create: implement(uploadsContract.create).handler(({ input }) =>
        this.service.upload(token, input),
      ),
    };
  }
}
