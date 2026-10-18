---
id: S-0002
title: Issue upload tokens for a project
status: done # proposed | in-progress | done | dropped
---

## Story

As a project's owner, I want to issue tokens for the project, so that my CI
can upload its lockfiles without my password or session.

## Acceptance criteria

- **AC1:** The project page has a Tokens section listing the project's
  tokens: name, last four characters, who created it, created date, last
  used date (or "never"), and expiry (or "never expires"). Expired tokens
  are marked as expired.
- **AC2:** A user creates a token by giving a name (1–100 characters) and an
  expiry: never, 30, 90 or 365 days. The full token, starting `vs_`, is then
  shown once with a copy button and a warning that it won't be shown again.
- **AC3:** Once that dialog is closed, the full token can't be seen again in
  the UI or through the api; only its last four characters.
- **AC4:** A user revokes a token after confirming; it disappears from the
  list.
- **AC5:** Only users who can see the project can list, create or revoke its
  tokens; for anyone else the api answers `NOT_FOUND`.
- **AC6:** The Tokens section and its dialogs fit a 360 px wide screen
  without page scroll.

## Notes

- A token belongs to its project, not to the user who created it, and can
  only upload to that project. Uploading with it, and rejecting revoked or
  expired tokens, is S-0003.
- Tokens are stored as a SHA-256 hash plus their last four characters, never
  in full. The `vs_` prefix lets secret scanners recognise a leaked token.
- Out of scope: organization-wide tokens, token permissions beyond upload,
  renaming or extending a token (revoke and create a new one).

## Implementation

- **Api:** `GET`, `POST /projects/{projectId}/upload-tokens` and
  `DELETE /projects/{projectId}/upload-tokens/{id}`
  (`packages/contracts/src/upload-tokens/`), implemented in
  `apps/api/src/upload-tokens/`: the `UploadToken` entity
  (`packages/entities/src/upload-token.entity.ts`, deleted with its
  project), and generating and hashing tokens in `upload-token.ts` (`vs_`
  and 32 random bytes in base64url; the SHA-256 hex is stored with the
  last four characters). Revoking sets `revokedAt`, and revoked tokens are
  no longer listed. Uploading with a token, and refusing revoked or
  expired ones, is S-0003.
- **Web:** the Tokens section of the project page,
  `apps/web/containers/upload-tokens/`: the table (`columns.tsx`; on
  phones the minor columns fold into the name cell), the create dialog,
  which shows the full token once with a copy button and forgets it when
  closed, and revoking through `ConfirmDialog`.
- **Tests:** `apps/api/test/upload-tokens/` with the cases in
  `packages/fixtures/src/api/upload-tokens/`, `apps/web/test/upload-tokens/`,
  and the browser tests in `apps/e2e/tests/upload-tokens.spec.ts` (AC1–AC4
  and AC6).
- **Commits:** `git log --grep "Story: S-0002"`.
