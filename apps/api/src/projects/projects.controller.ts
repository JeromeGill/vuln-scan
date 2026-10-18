import { Controller, Res } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { projectsContract } from "@repo/contracts";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { ProjectsService } from "./projects.service.js";

@Controller()
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Implement(projectsContract)
  // @Res() hands the response to oRPC: see orpc.ts.
  projects(@Session() session: UserSession, @Res() _res: unknown) {
    const organizationId = activeOrganizationId(session);
    return {
      list: implement(projectsContract.list).handler(({ input }) =>
        this.service.list(organizationId, input),
      ),
      create: implement(projectsContract.create).handler(({ input }) =>
        this.service.create(organizationId, input),
      ),
      get: implement(projectsContract.get).handler(({ input }) =>
        this.service.get(organizationId, input.id),
      ),
      rename: implement(projectsContract.rename).handler(
        ({ input: { id, ...body } }) =>
          this.service.rename(organizationId, id, body),
      ),
      delete: implement(projectsContract.delete).handler(({ input }) =>
        this.service.delete(organizationId, input.id),
      ),
    };
  }
}

/**
 * The organization the session works in. Every session gets one when it's
 * created (see docs/auth.md#organizations), so a session without one is a
 * bug, not a client error.
 */
function activeOrganizationId(session: UserSession): string {
  const id = session.session.activeOrganizationId;
  if (!id) throw new Error("The session has no active organization.");
  return id;
}
