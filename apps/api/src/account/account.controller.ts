import { Controller, Res } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { accountContract } from "@repo/contracts";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";

@Controller()
export class AccountController {
  @Implement(accountContract)
  // @Res() hands the response to oRPC: see orpc.ts.
  account(@Session() session: UserSession, @Res() _res: unknown) {
    const { id, name, email } = session.user;
    return {
      get: implement(accountContract.get).handler(() => ({ id, name, email })),
    };
  }
}
