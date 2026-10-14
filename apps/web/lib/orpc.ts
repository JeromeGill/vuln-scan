import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { ResponseValidationPlugin } from "@orpc/contract/plugins";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { contract } from "@repo/contracts";

const link = new OpenAPILink(contract, {
  // Same-origin /api, which next.config.ts proxies to the api. Only browser
  // code calls this client.
  url: () => `${window.location.origin}/api`,
  plugins: [
    // Parses responses with the contract's output schemas, which turns JSON
    // date strings back into `Date`s.
    new ResponseValidationPlugin(contract),
  ],
});

export const client: ContractRouterClient<typeof contract> =
  createORPCClient(link);

/** TanStack Query helpers: `orpc.account.get.queryOptions()`, … */
export const orpc = createTanstackQueryUtils(client);
