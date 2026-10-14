# Stories

Every feature has a user story here: what it does for the user and how to tell
it's done. They replace an external tracker. Stories are versioned with the
code, reviewed in the same branches, and linked to commits by a trailer.

| ID  | Title | Status |
| --- | ----- | ------ |

None yet: the first story is S-0001.

## Writing a story

1. Pick the next free number. Check open PRs and other branches too
   (`gh pr list`, `git branch -a`), since a number in use there isn't free.
2. Copy [`_template.md`](_template.md) to `NNNN-short-slug.md`, and fill in
   the story and acceptance criteria. Set `status: proposed`.
3. Add it to the table above.
4. Commit it on its own (`docs(stories): add S-NNNN <title>`) on a `docs/`
   branch and merge it to `main` in its own small PR, so the number is taken
   before work starts. The feature is then built on a branch named after the
   story: `feat/S-NNNN-short-slug`.

A story that changes the UI isn't done until its main flow has a browser
test in `apps/e2e` (see [Testing](../testing.md#browser-tests)), named after
the criteria it covers.

Keep acceptance criteria to observable behaviour (what the user or an api
client sees), one per line and numbered, so tests and reviews can point at
them. Implementation details belong in the Implementation section, filled in
when the story is done.

Statuses are `proposed`, `in-progress`, `done`, and `dropped`. Update the
status in the story and in the table as the work moves. A dropped story stays
in the folder so its number isn't reused.

Stories describe current behaviour, so keep them in step with the code. When
a change touches a story, update its acceptance criteria (and its text or
title if the change goes further) on the same branch. Add, reword, or remove
criteria without renumbering the others, since tests and commits cite them. A
larger change can instead be a new story that refers to the old one.

## Linking code to stories

- **Commits:** every `feat` and `fix` commit carries a `Story:` trailer, one
  line per story it touches:

  ```text
  feat(web): show the last scan on the dashboard

  Story: S-0005
  ```

  commitlint enforces this (`commitlint.config.mjs`): it rejects a `feat` or
  `fix` commit without the trailer, or one naming a story that has no file
  here. Other types (`docs`, `refactor`, `build`, …) don't need it. Find a
  story's commits with `git log --grep "Story: S-0005"`.

- **Tests:** start the names of tests written for a criterion with the story
  and criterion IDs, e.g. `it("S-0005 AC2: rejects a target that is already
  listed")`, so `vitest run -t S-0005` (or, for the browser tests,
  `playwright test -g S-0005`) runs a story's tests. The template's own
  tests (auth, the account route) predate any story and have plain names. A story that adds or
  changes an api route adds or updates that route's endpoint spec and
  fixture cases (see
  [Testing a new endpoint](../testing.md#testing-a-new-endpoint)).

- **Code comments:** don't reference stories in code. The commit history
  links them, and comments that point to stories go stale.
