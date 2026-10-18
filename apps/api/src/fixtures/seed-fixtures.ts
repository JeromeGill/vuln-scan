import { BaMember, BaUser, Project, UploadToken } from "@repo/entities";
import { fixturePassword, projects, uploadTokens, users } from "@repo/fixtures";
import { type DataSource, type FindOptionsWhere, IsNull } from "typeorm";
import type { Auth } from "../auth/auth.js";
import {
  generateUploadToken,
  uploadTokenExpiresAt,
} from "../upload-tokens/upload-token.js";

export interface SeedResult {
  /** Users signed up by this run (existing ones are left as they are). */
  users: number;
  /** Projects created by this run (existing names are skipped). */
  projects: number;
  /** Upload tokens created by this run (existing names are skipped). */
  uploadTokens: number;
}

/**
 * Signs the fixture users up through Better Auth and marks them verified, so
 * they can log in without opening an emailed link, then creates the fixture
 * projects in their owners' personal organizations, and the projects'
 * upload tokens (with random secrets nobody knows). Idempotent: users that
 * already exist are only verified, and projects and tokens already there are
 * skipped.
 */
export async function seedFixtures(
  dataSource: DataSource,
  auth: Auth,
): Promise<SeedResult> {
  const result: SeedResult = { users: 0, projects: 0, uploadTokens: 0 };
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
  /** The seeded projects by name, with their owner's user id. */
  const seededProjects = new Map<string, { id: string; ownerId: string }>();
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
    let project = await projectRepository.findOneBy({ organizationId, name });
    if (!project) {
      project = await projectRepository.save(
        projectRepository.create({ organizationId, name }),
      );
      result.projects++;
    }
    seededProjects.set(name, { id: project.id, ownerId: userId });
  }

  const tokenRepository = dataSource.getRepository(UploadToken);
  for (const { name, project: projectName, expiresInDays } of uploadTokens) {
    const project = seededProjects.get(projectName);
    if (!project) throw new Error(`No fixture project ${projectName}.`);
    const projectId = project.id;
    if (
      await tokenRepository.existsBy({ projectId, name, revokedAt: IsNull() })
    )
      continue;
    const { hash, lastFour } = generateUploadToken();
    await tokenRepository.save(
      tokenRepository.create({
        projectId,
        name,
        tokenHash: hash,
        lastFour,
        createdById: project.ownerId,
        expiresAt: uploadTokenExpiresAt(expiresInDays, new Date()),
      }),
    );
    result.uploadTokens++;
  }
  return result;
}
