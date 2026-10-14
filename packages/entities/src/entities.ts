import { BaAccount } from "./ba-account.entity.js";
import { BaSession } from "./ba-session.entity.js";
import { BaUser } from "./ba-user.entity.js";
import { BaVerification } from "./ba-verification.entity.js";
import { EmailDelivery } from "./email-delivery.entity.js";

/** Every entity, registered by `postgresOptions` (api and worker). */
export const entities = [
  BaUser,
  BaSession,
  BaAccount,
  BaVerification,
  EmailDelivery,
];
