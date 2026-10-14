/** Every fixture user signs in with this password. */
export const fixturePassword = "password123";

/** Users to sign up. */
export const users = [
  { name: "Alice Morgan", email: "alice@example.com" },
  { name: "Ben Carter", email: "ben@example.com" },
  { name: "Chloe Davies", email: "chloe@example.com" },
  { name: "Dev Patel", email: "dev@example.com" },
  { name: "Emma Wilson", email: "emma@example.com" },
] as const satisfies readonly UserFixture[];

export interface UserFixture {
  name: string;
  email: string;
}

export type UserEmail = (typeof users)[number]["email"];
