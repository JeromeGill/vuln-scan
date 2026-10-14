import { Logger } from "@nestjs/common";
import { onError, ORPCError, type ORPCModuleConfig } from "@orpc/nest";

const logger = new Logger("oRPC");

/**
 * Shared config for every `@Implement` route.
 *
 * oRPC's interceptor writes the response itself, but Nest would then call
 * `res.status(code).send()` again. That's silently ignored for most statuses
 * but throws `ERR_HTTP_HEADERS_SENT` for 204. Nest skips its own reply when a
 * handler injects `@Res()`, so every `@Implement` method takes an unused
 * `@Res() _res` parameter.
 */
export const orpcConfig: ORPCModuleConfig = {
  interceptors: [
    // Expected errors (NOT_FOUND, validation, …) are part of the contract;
    // anything else becomes a 500, so log it.
    onError((error) => {
      if (!(error instanceof ORPCError) || error.status >= 500) {
        logger.error(error);
      }
    }),
  ],
};
