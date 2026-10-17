# One file per decision, and no index tables

Parallel branches kept conflicting in the same few places: every story or
plan added a row to the table in its folder's README, every decision was
appended to the end of `docs/decisions.md`, and `CLAUDE.md` and `README.md`
listed what the app had "so far", which nearly every feature changed.

So decisions are one file each under `docs/decisions/`, named after their
title; the story and plan folders have no tables (each file's frontmatter
holds its status, and `grep` lists them); and `CLAUDE.md` and `README.md`
describe conventions and point to the docs pages instead of listing current
features. A generated table was considered and skipped: generated content
still conflicts, it only moves the fix to a rerun. Numbered decision files
were skipped too, since picking numbers is another thing branches collide
on.
