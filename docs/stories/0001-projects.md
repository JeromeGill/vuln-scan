---
id: S-0001
title: Create and manage projects
status: done # proposed | in-progress | done | dropped
---

## Story

As a signed-in user, I want a project for each app I deploy, so that its
lockfiles, environments and vulnerabilities are kept apart from my other
apps'.

## Acceptance criteria

- **AC1:** The dashboard lists the user's projects (name, created date),
  newest first. With none, it shows an empty state with a "Create project"
  button.
- **AC2:** A user creates a project by giving a name of 1–100 characters
  (trimmed); it then appears in the list and its project page opens.
- **AC3:** Project names are unique within the user's organization, ignoring
  case: a duplicate is rejected with a message on the name field.
- **AC4:** A user renames a project from its project page, with the same
  rules as AC2 and AC3.
- **AC5:** A user deletes a project from its project page after confirming by
  typing its name. It disappears from the list, and everything in it
  (tokens, environments, releases, stored files) is deleted with it.
- **AC6:** A user never sees another user's projects. Getting, renaming or
  deleting one through the api answers `NOT_FOUND`, the same as a project
  that doesn't exist.
- **AC7:** The dashboard and project page fit a 360 px wide screen without
  page scroll.

## Notes

- Every user gets a **personal organization** when they sign up (Better
  Auth's organization plugin), and projects belong to it rather than to the
  user, so teams later don't change the data model (see
  [P-0001](../plans/0001-vulnerability-monitoring.md)). The user never sees
  or names it in this story.
- Project pages are at `/projects/<id>`. The project page is mostly empty
  for now; tokens (S-0002) and environments (S-0003) fill it.
- Out of scope: teams, sharing, transferring a project, archiving.

## Implementation

- **Organizations:** Better Auth's organization plugin, with its models as
  entities in the `auth` schema; every user gets a personal organization at
  sign-up, which new sessions work in (`apps/api/src/auth/auth.ts`, see
  [Authentication](../auth.md#organizations)).
- **Api:** `GET`, `POST /projects` and `GET`, `PATCH`,
  `DELETE /projects/{id}` (`packages/contracts/src/projects/`), implemented
  in `apps/api/src/projects/` on the `Project` entity
  (`packages/entities/src/project.entity.ts`: belongs to an organization,
  name unique ignoring case). Another organization's project is
  `NOT_FOUND`, a taken name a `CONFLICT`. Deleting a project deletes its
  stored files (under its key prefix) first, then the project, whose
  tokens, environments, releases and lockfiles go with it.
- **Web:** the dashboard's projects table and create dialog
  (`apps/web/containers/projects/projects-table.tsx`,
  `create-project-dialog.tsx`, sharing `project-form.tsx`), and the project
  page (`project-page.tsx`) with its rename dialog and its delete dialog,
  which needs the name typed before it deletes and then returns to
  `/dashboard` (`rename-project-dialog.tsx`, `delete-project-dialog.tsx`,
  through `ConfirmDialog`).
- **Tests:** `apps/api/test/projects/` with the cases in
  `packages/fixtures/src/api/projects/`, `apps/web/test/projects/` and
  `apps/web/test/dashboard/`, and the browser tests in
  `apps/e2e/tests/projects.spec.ts` (AC1–AC5 and AC7; AC6 is api only).
- **Commits:** `git log --grep "Story: S-0001"`.
