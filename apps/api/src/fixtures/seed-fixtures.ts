import { BaMember, BaUser, Project } from "@repo/entities";
import { fixturePassword, projects, users } from "@repo/fixtures";
import type { DataSource, FindOptionsWhere } from "typeorm";
import type { Auth } from "../auth/auth.js";

export interface SeedResult {
  /** Users signed up by this run (existing ones are left as they are). */
  users: number;
  /** Projects created by this run (existing names are skipped). */
  projects: number;
}

/**
 * Signs the fixture users up through Better Auth and marks them verified, so
 * they can log in without opening an emailed link, then creates the fixture
 * projects in their owners' personal organizations. Idempotent: users that
 * already exist are only verified, and projects already there are skipped.
 */
export async function seedFixtures(
  dataSource: DataSource,
  auth: Auth,
): Promise<SeedResult> {
  const result: SeedResult = { users: 0, projects: 0 };
  const { internalAdapter } = await auth.$context;
  const userIds = new Map<string, string>();
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
    userIds.set(email, user.id);
  }

  const projectRepository = dataSource.getRepository(Project);
  for (const { name, owner } of projects) {
    const userId = userIds.get(owner);
    if (!userId) throw new Error(`No fixture user ${owner}.`);
    // The personal organization: every user's only membership for now.
    const membership = await dataSource
      .getRepository(BaMember)
      .createQueryBuilder("member")
      .where({ userId } satisfies FindOptionsWhere<BaMember>)
      .orderBy("member.createdAt", "ASC")
      .getOne();
    if (!membership) throw new Error(`${owner} has no organization.`);
    const { organizationId } = membership;
    if (await projectRepository.existsBy({ organizationId, name })) continue;
    await projectRepository.save(
      projectRepository.create({ organizationId, name }),
    );
    result.projects++;
  }
  return result;
}
