---
id: S-0001
title: Create and manage projects
status: in-progress # proposed | in-progress | done | dropped
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

Filled in when the story is done: the main files and routes, and the commits
(`git log --grep "Story: S-0001"`).
