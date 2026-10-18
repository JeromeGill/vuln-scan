import { env } from "@repo/config/api";
import { createAuth } from "./auth/auth.js";
import { initializeDataSource } from "./database.js";
import { seedFixtures } from "./fixtures/seed-fixtures.js";

// Loads @repo/fixtures into DB_NAME. Run with `script/seed`.
if (env.NODE_ENV === "production") {
  throw new Error("Refusing to seed fixtures when NODE_ENV is production.");
}

const dataSource = await initializeDataSource();
try {
  // Fixture users are verified without an email, so nothing is published.
  const auth = createAuth(dataSource, { publish: async () => {} });
  const result = await seedFixtures(dataSource, auth);
  console.log(
    `Seeded ${env.DB_NAME}: created ${result.users} users, ${result.projects} projects, and ${result.uploadTokens} upload tokens.`,
  );
} finally {
  await dataSource.destroy();
}
