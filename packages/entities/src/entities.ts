import { BaAccount } from "./ba-account.entity.js";
import { BaInvitation } from "./ba-invitation.entity.js";
import { BaMember } from "./ba-member.entity.js";
import { BaOrganization } from "./ba-organization.entity.js";
import { BaSession } from "./ba-session.entity.js";
import { BaUser } from "./ba-user.entity.js";
import { BaVerification } from "./ba-verification.entity.js";
import { EmailDelivery } from "./email-delivery.entity.js";
import { Environment } from "./environment.entity.js";
import { Lockfile } from "./lockfile.entity.js";
import { Project } from "./project.entity.js";
import { Release } from "./release.entity.js";
import { UploadToken } from "./upload-token.entity.js";

/** Every entity, registered by `postgresOptions` (api and worker). */
export const entities = [
  BaUser,
  BaSession,
  BaAccount,
  BaVerification,
  BaOrganization,
  BaMember,
  BaInvitation,
  EmailDelivery,
  Project,
  UploadToken,
  Environment,
  Release,
  Lockfile,
];
