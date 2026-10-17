---
id: S-0003
title: Upload lockfiles from CI
status: proposed # proposed | in-progress | done | dropped
---

## Story

As a developer setting up CI, I want to upload my app's lockfiles with a
project token, tagged with the environment and version I'm deploying, so
that vulnscan knows what is running where.

## Acceptance criteria

- **AC1:** `POST /api/uploads` with `Authorization: Bearer <token>` and a
  multipart body of `environment`, `version`, `path` and `file` stores the
  file in the token's project and answers `201` with the environment,
  version, path, and whether the release is live.
- **AC2:** A missing, unknown, revoked or expired token is answered `401`
  and nothing is stored.
- **AC3:** The first upload with an environment name creates that
  environment. Names are 1–64 characters of lowercase letters, digits, `.`,
  `-` and `_`, starting with a letter or digit; anything else is answered
  `400` with the rule.
- **AC4:** An upload with a version the environment hasn't had before
  creates a release for it and makes that release live.
- **AC5:** An upload with an existing version adds the file to that release,
  or replaces the file already at that path, and doesn't change which
  release is live.
- **AC6:** `version` is any string of 1–128 printable characters; vulnscan
  doesn't interpret or order it.
- **AC7:** `path` is a relative path (no leading `/`, no `..`) of at most
  255 characters whose file name is one of `package-lock.json`,
  `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `poetry.lock`, `uv.lock`,
  `Pipfile.lock` or `requirements.txt`; anything else is answered `400`
  listing the supported names.
- **AC8:** A file over 20 MB is answered `413` and nothing is stored.
- **AC9:** A successful upload updates the token's "last used" date in the
  token list.
- **AC10:** The project page lists the project's environments with their
  live version and when it was uploaded, and shows a ready-to-copy `curl`
  example for uploading to this project.

## Notes

- The body is multipart with plain form fields; see
  [P-0001](../plans/0001-vulnerability-monitoring.md#getting-the-file-in)
  for why, and for switching to a JSON `metadata` part if it grows.
- Files are stored through `@repo/storage` under the project's key prefix,
  so deleting a project (S-0001 AC5) removes them.
- Scanning the uploaded files is S-0004; this story only stores them.
- Out of scope: several files in one request, choosing an earlier release
  as live (S-0006), release history in the UI (S-0005), rate limiting.

## Implementation

Filled in when the story is done: the main files and routes, and the commits
(`git log --grep "Story: S-0003"`).
