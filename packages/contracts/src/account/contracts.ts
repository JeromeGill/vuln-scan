import { base } from "../base.js";
import { accountSchema } from "./schemas.js";

export const accountPath = "/account";

/**
 * The signed-in user's account: an example route that shows the whole path
 * from the web app's oRPC client through the proxy to the api.
 */
export const accountContract = base
  .prefix(accountPath)
  .tag("Account")
  .router({
    get: base.route({ method: "GET", path: "/" }).output(accountSchema),
  });
