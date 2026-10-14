import { BaUser } from "@repo/entities";
import { fixturePassword, users } from "@repo/fixtures";
import type { DataSource } from "typeorm";
import type { Auth } from "../auth/auth.js";

export interface SeedResult {
  /** Users signed up by this run (existing ones are left as they are). */
  users: number;
}

/**
 * Signs the fixture users up through Better Auth and marks them verified, so
 * they can log in without opening an emailed link. Idempotent: users that
 * already exist are only verified.
 */
export async function seedFixtures(
  dataSource: DataSource,
  auth: Auth,
): Promise<SeedResult> {
  const result: SeedResult = { users: 0 };
  const { internalAdapter } = await auth.$context;
  for (const { name, email } of users) {
    let user: { id: string; emailVerified: boolean } | null = await dataSource
      .getRepository(BaUser)
      .findOneBy({ email });
    if (!user) {
      ({ user } = await auth.api.signUpEmail({
        body: { name, email, password: fixturePassword },
      }));
      result.users++;
    }
    if (!user.emailVerified) {
      await internalAdapter.updateUser(user.id, { emailVerified: true });
    }
  }
  return result;
}
