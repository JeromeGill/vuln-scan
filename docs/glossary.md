# Glossary

The words the stories, plans, and code use for the app's ideas. Use them in
the same sense everywhere, so a story's criteria can't be read two ways.

## Accounts

- **User:** someone with an account, signed up with an email and password
  or with Google. Entity: `BaUser` (Better Auth's `user`).
- **Verified:** a user who has opened the link from their verification
  email (or signed in with Google, which vouches for the address). Only
  verified users can log in with a password.
- **Organization:** who owns projects. Every user gets a personal
  organization at sign-up; teams (later) are organizations with several
  members. Better Auth's organization plugin.

## Projects and uploads

- **Project:** one app the user deploys, owned by an organization. Holds
  its upload tokens and environments.
- **Upload token:** a credential issued from a project (`vs_…`) that lets
  CI upload lockfiles to that project only. Shown once, stored hashed,
  revocable, optionally expiring.
- **Environment:** a place a project is deployed (`production`,
  `staging`), created by the first upload that names it.
- **Version:** the label CI sends with an upload (a tag, a commit SHA). An
  opaque string: never parsed or ordered.
- **Release:** an environment's files for one version. Uploads with the
  same environment and version join the same release.
- **Live release:** the release an environment is running, and the only
  one scanned. A new release becomes live when first uploaded; a user can
  make an earlier one live (a rollback).
- **Lockfile:** an uploaded dependency file (`pnpm-lock.yaml`,
  `poetry.lock`, …), identified by its path within the release.

## Avoid

Add words here that are easy to use in two senses, with the one to use
instead.

- **Deployment** for a release: say release (or live release). "Deployment"
  is kept for deploying vulnscan itself.
- **Token** alone, where it could mean a session: say upload token.
