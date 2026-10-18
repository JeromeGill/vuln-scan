# Authentication

Authentication uses [Better Auth](https://www.better-auth.com/) with email and
password (and optionally Google), plus its organization plugin for each
user's personal organization. The server runs inside the NestJS api, and the web app uses Better
Auth's React client.

## API side

- **Configuration:** `apps/api/src/auth/auth.ts` (`createAuth`): email and
  password enabled with email verification required (see
  [Email verification](#email-verification)), `basePath: "/api/auth"`,
  `secret`/`baseURL` from config, and the web origin (`WEB_URL`) in
  `trustedOrigins`. `baseURL` (`BETTER_AUTH_URL`) is the **web origin**, not
  the api's, so the links Better Auth builds go through the web app's proxy.
- **Nest integration:** `@thallesp/nestjs-better-auth`, registered in
  `AppModule` with `AuthModule.forRootAsync`, injecting the TypeORM
  `DataSource`. It mounts Better Auth's handler at `/api/auth/*`.
- **Body parser:** Better Auth needs the raw request body, so `main.ts`
  creates the app with `bodyParser: false`. The module re-adds the JSON and
  urlencoded parsers for other routes. Tests must do the same.
- **Database:** Better Auth uses the in-repo adapter
  `apps/api/src/auth/typeorm-adapter.ts`. `createAuth` passes it a map from
  Better Auth model keys (`user`, `session`, `account`, `verification`,
  and the organization plugin's `organization`, `member`, `invitation`) to
  entities, so table and schema names are up to the entities (they live in
  the `auth` schema; see [Database](database.md#better-auth-tables)). The
  adapter runs Better Auth's multi-step writes (such as sign-up creating a
  user and an account) in a database transaction.

### Route protection

The module registers a **global guard**: every route requires a valid session
unless it says otherwise.

```ts
import { Controller, Get } from "@nestjs/common";
import {
  AllowAnonymous,
  OptionalAuth,
  Session,
  type UserSession,
} from "@thallesp/nestjs-better-auth";

@Controller("examples")
export class ExamplesController {
  @Get("public")
  @AllowAnonymous() // no session needed
  publicRoute() {}

  @Get("me") // session required (the default)
  me(@Session() session: UserSession) {
    return session.user;
  }

  @Get("feed")
  @OptionalAuth() // session if present, anonymous otherwise
  feed(@Session() session: UserSession | null) {}
}
```

Every oRPC route needs a session except `POST /uploads`
([S-0003](stories/0003-upload-lockfiles.md)), which CI calls with a
project's upload token instead: it's `@AllowAnonymous()` to Better Auth
and guarded by `UploadTokenGuard` (`apps/api/src/uploads/`), which hashes
the `Authorization: Bearer vs_…` token, looks it up, and answers 401 (in
oRPC's error shape) for a missing, unknown, revoked or expired one before
the body is read. The handler gets the token with `@CurrentUploadToken()`.
Better Auth's own endpoints under `/api/auth` are public too.

### Endpoints in use

All under `/api/auth`:

| Endpoint                        | Used by                                         |
| ------------------------------- | ----------------------------------------------- |
| `POST /sign-up/email`           | sign-up form, tests                             |
| `POST /sign-in/email`           | login form, tests                               |
| `GET /verify-email`             | the link in the verification email              |
| `POST /send-verification-email` | check-inbox and link-error pages ("send again") |
| `POST /sign-out`                | header sign-out                                 |
| `GET /get-session`              | `getSession()`, tests                           |

The session cookie is `better-auth.session_token`. Passwords must be at least
8 characters (Better Auth's default).

### Email verification

All Better Auth behaviour (1.7.7), configured in `createAuth`:

- **Sign-up doesn't sign in** (`requireEmailVerification`). It answers
  `token: null` and emails a link (`sendOnSignUp`). An address that already
  has an account gets the same answer and no email, so sign-up doesn't
  reveal who has an account.
- **Logging in before verifying** fails with `403 EMAIL_NOT_VERIFIED` and
  emails a new link (`sendOnSignIn`). `POST /send-verification-email` sends
  one on request (it answers the same whether or not the address has an
  unverified account).
- **The link** is `${BETTER_AUTH_URL}/api/auth/verify-email?token=…&callbackURL=…`.
  The token is a signed JWT valid for an hour (`expiresIn`, Better Auth's
  default), not a database row. Opening it verifies the address, signs in
  (`autoSignInAfterVerification`), and redirects to `callbackURL`. Expired:
  redirects to `callbackURL?error=TOKEN_EXPIRED`; malformed:
  `?error=INVALID_TOKEN`. Opened again after use: redirects to `callbackURL`
  with no error and no new session.
- **Sending:** `sendVerificationEmail` publishes an `email.verify-email` job
  through the api's `JobPublisher` (`apps/api/src/messaging/`), and the
  worker sends it (see [Messaging](messaging.md#message-types)). It doesn't
  await the publish, as Better Auth advises, so response times don't reveal
  which addresses have accounts; a failed publish is logged, and the user
  asks for a new link.
- The seeder marks fixture users verified through Better Auth's internal
  adapter (`internalAdapter.updateUser`), never a direct write.

### Sign in with Google

`socialProviders.google` (`prompt: "select_account"`) is configured
only when the api has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and the
web shows the button only when `GOOGLE_SIGN_IN` is on, so dev and tests work
without Google.

- **Flow:** the button calls `signIn.social({ provider: "google",
  callbackURL: "/dashboard", errorCallbackURL: "/login" })`. Google comes back
  to `${BETTER_AUTH_URL}/api/auth/callback/google`, on the web origin
  through the proxy, so the session cookie lands there. The OAuth client
  lists that URI for localhost and the Railway web domain.
- **Linking:** Better Auth's defaults (1.7.7, `oauth2/link-account`). A
  new email creates a verified account (no verification email). An
  existing account with the same email is linked only if Google says the
  email is verified **and** the account is verified
  (`accountLinking.requireLocalEmailVerified`, default `true`); otherwise
  it redirects to `/login?error=account_not_linked`. That stops someone who
  signed up with another person's address, never verified it, and kept the
  password from getting into the real owner's account once they use Google.
- **Errors:** cancelling on Google's page comes back as
  `/login?error=access_denied`, a failed code exchange as `?error=invalid_code`;
  the login page shows a message for each.
- **Setup:** the consent screen and the OAuth client can only be made in
  the Google Cloud console (APIs & Services → OAuth consent screen, then
  Credentials → OAuth client ID, type "Web application"), with no API or
  OpenTofu resource. Add each web origin's
  `/api/auth/callback/google` as an authorised redirect URI.

### Organizations

Better Auth's organization plugin (`organization()` in `createAuth`; the
teams sub-feature is off). App data such as projects belongs to an
organization, never directly to a user, so teams later are "an organization
with more members", not a data model change (see
[P-0001](plans/0001-vulnerability-monitoring.md)). For now every user has
exactly one, their **personal organization**, which they never see or name:

- **Created at sign-up**, for email/password, Google, and seeded users
  alike: `databaseHooks.user.create.after` calls
  `auth.api.createOrganization` as a server call (no headers, the user's
  id in the body), which makes the user its `owner`. The hook runs once the
  transaction that created the user has committed, and before a Google
  sign-in creates its first session. Name `Personal`; slug
  `personal-<user id>` (`personalOrganizationSlug`), unique because the user
  id is. If creating it fails, the sign-up request fails, though the user
  row is already committed.
- **Every session works in it:** `databaseHooks.session.create.before` sets
  `session.activeOrganizationId` to the user's first membership (the
  personal organization), so routes can take the organization from
  `session.session.activeOrganizationId` (returned by `get-session` too).
- **Locked down until teams:** `allowUserToCreateOrganization: false` (the
  sign-up hook's server call is still allowed), `disableOrganizationDeletion:
  true`, and `membershipLimit: 1`, so a user can't make more organizations,
  delete theirs, or add members. The plugin's other endpoints under
  `/api/auth/organization/*` (e.g. `list`, `get-full-organization`) work for
  the signed-in user; the web app doesn't call any yet. No invitation email
  is configured.
- Why a hook, the slug, and the active organization: see
  [Decisions](decisions/personal-organizations-are-made-by-a-user-creation-hook.md).
- **Deleting a user** deletes their memberships and invitations (cascade),
  not the organization: delete that explicitly (the api tests'
  `deleteUsers` helper does).

## Web side

- **Proxy:** `apps/web/next.config.ts` rewrites `/api/auth/*` to
  `${API_URL}/api/auth/*` (and other `/api/*` to the api's oRPC routes,
  which need the same cookie). The browser only talks to `localhost:3000`, so the
  session cookie belongs to the web origin and no CORS is involved. Why: see
  [Decisions](decisions/web-proxies-auth-to-the-api.md).
- **Client:** `apps/web/lib/auth-client.ts` creates the client with
  `createAuthClient()` and **no `baseURL`**, so it calls the web origin, which
  is the proxy. It exports `signIn`, `signUp`, `signOut`, and
  `sendVerificationEmail`.
- **Pages:** `/login`, `/sign-up`, and `/check-inbox` are in the
  `app/(auth)/` route group, whose layout centres a shadcn card and
  redirects to `/dashboard` if already signed in. Each `page.tsx` is a server
  component (for `metadata`) that renders a client component.
  - Sign-up goes to `/check-inbox?email=…` ("we've sent a link", with a
    "Send it again" button).
  - Login passes `callbackURL: "/verify-email"`, so a link sent by a refused
    login lands there too; on success Better Auth's client navigates to
    that callback, which forwards to `/dashboard`. On `EMAIL_NOT_VERIFIED` it says
    to verify first and links to `/check-inbox`.
  - `/verify-email` (outside both groups) is every
    verification link's `callbackURL`. Without `?error` it redirects to
    `/dashboard` (which sends a signed-out visitor to `/login`); with one it says
    the link expired or isn't valid and asks for the email to send a new
    one.
  - With `GOOGLE_SIGN_IN` on, the login and sign-up pages (their
    `page.tsx`, on the server) show "Continue with Google"
    (`app/(auth)/google-button.tsx`). The login page also shows the
    message for the `?error=` a Google sign-in came back with.
- **Protected pages:** the `app/(app)/` layout calls `getSession()`
  (`lib/session.ts`), which forwards the request's cookie to
  `${API_URL}/api/auth/get-session`, and redirects to `/login` without a
  session. The header's account menu signs out with `signOut()`.

## Origin checks

Better Auth rejects requests whose `Origin` header isn't trusted
(`403 INVALID_ORIGIN`). Proxied browser requests carry the web origin, so
`WEB_URL` must match where the web app is served. If you serve the web app
from another origin (another port, a deployed domain), set `WEB_URL`
accordingly.

## Rules

- **Never write to the Better Auth tables directly** (`BaUser`, `BaSession`,
  `BaAccount`, `BaVerification`, `BaOrganization`, `BaMember`,
  `BaInvitation`; the `auth` schema). Use Better Auth instead:
  `auth.api.*`, the injected `AuthService` from `@thallesp/nestjs-better-auth`,
  or its HTTP endpoints. This keeps password hashing, hooks, and session
  handling consistent.
- Reading them is fine (assertions, joins, a foreign key from an app table to
  `auth.user`).
- **Exception:** integration test fixtures may write to them directly for
  setup and teardown. The behaviour under test still goes through Better Auth.
- Enabling a Better Auth plugin that adds models or fields means adding
  matching entities or properties, and adding new models to the adapter map
  in `createAuth`.
