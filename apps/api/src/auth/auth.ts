import { Logger } from "@nestjs/common";
import { env } from "@repo/config/api";
import {
  BaAccount,
  BaInvitation,
  BaMember,
  BaOrganization,
  BaSession,
  BaUser,
  BaVerification,
} from "@repo/entities";
import { createMessage, verifyEmail } from "@repo/events";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins/organization";
import type { DataSource, FindOptionsWhere } from "typeorm";
import type { JobPublisher } from "../messaging/job-publisher.js";
import { typeormAdapter } from "./typeorm-adapter.js";

/**
 * How long a verification link works, in seconds: Better Auth's default
 * `emailVerification.expiresIn`, set here too so the job's `expiresAt`
 * matches it.
 */
const VERIFICATION_EXPIRES_IN = 3600;

const logger = new Logger("Auth");

/**
 * The slug of `userId`'s personal organization: unique because the user id
 * is. The user never sees it.
 */
export function personalOrganizationSlug(userId: string): string {
  return `personal-${userId}`;
}

/** The name of every personal organization; the user never sees it. */
export const PERSONAL_ORGANIZATION_NAME = "Personal";

/**
 * `publisher` sends the verification emails; scripts that never sign
 * anyone up can pass one that does nothing.
 */
export function createAuth(
  dataSource: DataSource,
  publisher: Pick<JobPublisher, "publish">,
) {
  // Set once `betterAuth` has returned, since it needs `auth.api`; the
  // user hook that calls it only runs after that.
  let createPersonalOrganization:
    | ((userId: string) => Promise<unknown>)
    | null = null;

  const auth = betterAuth({
    // Tables live in the `auth` schema under Better Auth's default model names.
    database: typeormAdapter(dataSource, {
      user: BaUser,
      session: BaSession,
      account: BaAccount,
      verification: BaVerification,
      organization: BaOrganization,
      member: BaMember,
      invitation: BaInvitation,
    }),
    secret: env.BETTER_AUTH_SECRET,
    // The web origin: verification links are built from it, so they and
    // the session cookie go through the web app's /api/auth proxy.
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    // The web app proxies /api/auth, so its requests carry the web origin.
    trustedOrigins: [env.WEB_URL],
    // Google sign-in, when its credentials are set. Linking a
    // Google login to an existing account by email is Better Auth's
    // default: only when both Google and the account say the email is
    // verified (`accountLinking.requireLocalEmailVerified`).
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              prompt: "select_account",
            },
          }
        : {},
    emailAndPassword: {
      enabled: true,
      // Sign-up doesn't sign in, and logging in before verifying fails with
      // EMAIL_NOT_VERIFIED.
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      // A refused login sends a new link.
      sendOnSignIn: true,
      // Opening the link signs in.
      autoSignInAfterVerification: true,
      expiresIn: VERIFICATION_EXPIRES_IN,
      // The worker sends the email. Not awaited, as Better Auth advises:
      // response times would tell whether an address has an account. If
      // publishing fails, the user asks for a new link.
      sendVerificationEmail: async ({ user, url }) => {
        const job = createMessage(verifyEmail, {
          userId: user.id,
          email: user.email,
          name: user.name,
          url,
          expiresAt: new Date(
            Date.now() + VERIFICATION_EXPIRES_IN * 1000,
          ).toISOString(),
        });
        publisher.publish(verifyEmail, job).catch((error: unknown) => {
          logger.error(
            `Publishing the verification email for user ${user.id} failed`,
            error,
          );
        });
      },
    },
    plugins: [
      // Organizations: for now each user's personal one only (see
      // docs/auth.md#organizations). Users can't create or delete one, or
      // add members; the user hook below creates it as a server call.
      organization({
        allowUserToCreateOrganization: false,
        disableOrganizationDeletion: true,
        membershipLimit: 1,
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          // Every user (email/password, Google, seeded) gets a personal
          // organization, which they own. Runs once the transaction that
          // created the user has committed, before a Google sign-in creates
          // the first session.
          after: async (user) => {
            if (!createPersonalOrganization) {
              throw new Error("Better Auth isn't initialized yet");
            }
            await createPersonalOrganization(user.id);
          },
        },
      },
      session: {
        create: {
          // Sessions work in the user's personal organization: their
          // first membership, made at sign-up.
          before: async (session) => {
            const membership = await dataSource
              .getRepository(BaMember)
              .createQueryBuilder("member")
              .where({
                userId: session.userId,
              } satisfies FindOptionsWhere<BaMember>)
              .orderBy("member.createdAt", "ASC")
              .getOne();
            return {
              data: {
                ...session,
                activeOrganizationId: membership?.organizationId ?? null,
              },
            };
          },
        },
      },
    },
  });

  createPersonalOrganization = (userId) =>
    // A server call (no headers) naming the user: allowed although users
    // can't create organizations themselves.
    auth.api.createOrganization({
      body: {
        name: PERSONAL_ORGANIZATION_NAME,
        slug: personalOrganizationSlug(userId),
        userId,
      },
    });

  return auth;
}

export type Auth = ReturnType<typeof createAuth>;
