import { BaUser } from "@repo/entities";
import { fixturePassword, users } from "@repo/fixtures";
import { DataSource, In } from "typeorm";
import { createAuth, type Auth } from "../../src/auth/auth.js";
import { initializeDataSource } from "../../src/database.js";
import { seedFixtures } from "../../src/fixtures/seed-fixtures.js";
import { publisher } from "../helpers/app.js";

describe("Fixtures: seed (integration)", () => {
  let dataSource: DataSource;
  let auth: Auth;
  const emails = users.map(({ email }) => email);

  beforeAll(async () => {
    dataSource = await initializeDataSource();
    auth = createAuth(dataSource, publisher);
    await dataSource.getRepository(BaUser).delete({ email: In(emails) });
  });

  afterAll(async () => {
    await dataSource?.getRepository(BaUser).delete({ email: In(emails) });
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

  it("is idempotent", async () => {
    await expect(seedFixtures(dataSource, auth)).resolves.toEqual({ users: 0 });
  });
});
