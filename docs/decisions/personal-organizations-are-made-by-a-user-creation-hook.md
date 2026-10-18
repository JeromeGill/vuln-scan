# Personal organizations are made by a user-creation hook

Every user gets a personal organization (Better Auth's organization plugin)
so that app data belongs to an organization from the start. It is created
in `databaseHooks.user.create.after`, by calling
`auth.api.createOrganization` as a server call with the user's id, rather
than in the sign-up route or on first sign-in:

- **One place for every way in.** Email/password sign-up, Google's first
  sign-in, and the seeder all create users through Better Auth, so they all
  pass through the hook. A hook on the sign-up endpoint would miss Google.
- **Through Better Auth, not the tables.** `createOrganization` writes the
  organization and the owner membership itself, keeping the rule that
  Better Auth tables are only written by Better Auth. Users can't create
  organizations (`allowUserToCreateOrganization: false`), but Better Auth
  treats a headerless call naming a `userId` as a system action and allows
  it.
- **Not lazily on first sign-in:** sign-up doesn't sign in (email
  verification), and the story wants the organization to exist from
  sign-up. A lazy creation would also have to handle two first requests
  racing.

The hook runs after the user's transaction commits, so a failure leaves a
user without an organization (the sign-up request fails). Accepted while
there are no real users; a repair on sign-in could be added if it ever
happens.

The slug is `personal-<user id>`: deterministic and unique without a lookup,
and the user never sees it. Each new session's `activeOrganizationId` is
set to the user's first membership in `databaseHooks.session.create.before`
(Better Auth's suggested way to give sessions a default organization), so
routes read the organization from the session, which is what they will do
once a user can switch between organizations. The first membership, not the
slug, so renaming the organization later doesn't break it.

Until teams, users also can't delete their organization
(`disableOrganizationDeletion`) or add members (`membershipLimit: 1`); the
teams story lifts these.
