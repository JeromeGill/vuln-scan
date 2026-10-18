import { BaMember, BaUser, Project, UploadToken } from "@repo/entities";
import { fixturePassword, projects, uploadTokens, users } from "@repo/fixtures";
import { DataSource, In } from "typeorm";
import { createAuth, type Auth } from "../../src/auth/auth.js";
import { initializeDataSource } from "../../src/database.js";
import { seedFixtures } from "../../src/fixtures/seed-fixtures.js";
import { deleteUsers, publisher } from "../helpers/app.js";

describe("Fixtures: seed (integration)", () => {
  let dataSource: DataSource;
  let auth: Auth;
  const emails = users.map(({ email }) => email);

  beforeAll(async () => {
    dataSource = await initializeDataSource();
    auth = createAuth(dataSource, publisher);
    await deleteUsers(dataSource, emails);
  });

  afterAll(async () => {
    if (dataSource) await deleteUsers(dataSource, emails);
    await dataSource?.destroy();
  });

  it("signs up every fixture user, verified, with the fixture password", async () => {
    await expect(seedFixtures(dataSource, auth)).resolves.toEqual({
      users: users.length,
      projects: projects.length,
      uploadTokens: uploadTokens.length,
    });

    const seeded = await dataSource
      .getRepository(BaUser)
      .findBy({ email: In(emails) });
    expect(seeded).toHaveLength(users.length);
    expect(seeded.every((user) => user.emailVerified)).toBe(true);
    await expect(
      auth.api.signInEmail({
        body: { email: users[0].email, password: fixturePassword },
      }),
    ).resolves.toMatchObject({ user: { email: users[0].email } });
  });

  it("gives every fixture user a personal organization, which they own", async () => {
    const seeded = await dataSource
      .getRepository(BaUser)
      .findBy({ email: In(emails) });
    const memberships = await dataSource
      .getRepository(BaMember)
      .findBy({ userId: In(seeded.map((user) => user.id)) });

    expect(memberships.map(({ userId }) => userId).toSorted()).toEqual(
      seeded.map(({ id }) => id).toSorted(),
    );
    expect(memberships.every(({ role }) => role === "owner")).toBe(true);
  });

  it("creates the fixture projects in their owners' organizations", async () => {
    const organizationIds: string[] = [];
    for (const { name, owner } of projects) {
      const user = await dataSource
        .getRepository(BaUser)
        .findOneByOrFail({ email: owner });
      const { organizationId } = await dataSource
        .getRepository(BaMember)
        .findOneByOrFail({ userId: user.id });
      organizationIds.push(organizationId);
      await expect(
        dataSource.getRepository(Project).existsBy({ organizationId, name }),
      ).resolves.toBe(true);
    }
    await expect(
      dataSource
        .getRepository(Project)
        .countBy({ organizationId: In(organizationIds) }),
    ).resolves.toBe(projects.length);
  });

  it("creates the fixture upload tokens for their projects, by the projects' owners", async () => {
    for (const { name, project: projectName, expiresInDays } of uploadTokens) {
      const owner = projects.find(
        (project) => project.name === projectName,
      )?.owner;
      if (!owner) throw new Error(`No fixture project ${projectName}.`);
      const user = await dataSource
        .getRepository(BaUser)
        .findOneByOrFail({ email: owner });
      const { organizationId } = await dataSource
        .getRepository(BaMember)
        .findOneByOrFail({ userId: user.id });
      const project = await dataSource
        .getRepository(Project)
        .findOneByOrFail({ organizationId, name: projectName });
      const token = await dataSource
        .getRepository(UploadToken)
        .findOneByOrFail({ projectId: project.id, name });
      expect(token).toMatchObject({
        createdById: user.id,
        lastUsedAt: null,
        revokedAt: null,
      });
      expect(token.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(token.expiresAt === null).toBe(expiresInDays === null);
    }
  });

  it("is idempotent", async () => {
    await expect(seedFixtures(dataSource, auth)).resolves.toEqual({
      users: 0,
      projects: 0,
      uploadTokens: 0,
    });
  });
});
