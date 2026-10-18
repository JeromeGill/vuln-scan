import { Controller, Res } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { environmentsContract } from "@repo/contracts";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { activeOrganizationId } from "../auth/active-organization.js";
import { EnvironmentsService } from "./environments.service.js";

@Controller()
export class EnvironmentsController {
  constructor(private readonly service: EnvironmentsService) {}

  @Implement(environmentsContract)
  // @Res() hands the response to oRPC: see orpc.ts.
  environments(@Session() session: UserSession, @Res() _res: unknown) {
    const organizationId = activeOrganizationId(session);
    return {
      list: implement(environmentsContract.list).handler(
        ({ input: { projectId, ...params } }) =>
          this.service.list(organizationId, projectId, params),
      ),
    };
  }
}
