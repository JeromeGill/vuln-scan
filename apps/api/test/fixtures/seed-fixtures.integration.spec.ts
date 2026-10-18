import { BaMember, BaUser } from "@repo/entities";
import { fixturePassword, users } from "@repo/fixtures";
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

  it("is idempotent", async () => {
    await expect(seedFixtures(dataSource, auth)).resolves.toEqual({ users: 0 });
  });
});
