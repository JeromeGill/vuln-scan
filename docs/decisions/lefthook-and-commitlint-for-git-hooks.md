# lefthook and commitlint for git hooks

lefthook runs the pre-commit checks in parallel from one YAML file and needs
no generated hook scripts in the repo. Formatting is fixed rather than
checked: the hook formats and re-stages the staged files, so formatting never
blocks a commit. Format and lint run on staged files only. Type checking covers the whole project, because a change in one file can
break another, and runs package `check-types` scripts directly instead of
through Turbo, where web's `check-types` waits for a full `next build`.
commitlint enforces the Conventional Commits rule from `CLAUDE.md`.
