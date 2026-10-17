# Stories in the repo instead of an issue tracker

Every feature has a user story in `docs/stories/`, rather than in Jira or
GitHub Issues. Stories are versioned and reviewed with the code, work offline,
and don't tie the project to a hosting provider. Commits link to them with a
`Story:` trailer, enforced for `feat` and `fix` by a commitlint rule that also
checks the story file exists, so `git log --grep` finds a story's changes.
Code comments don't reference stories because they go stale. Gherkin
`.feature` files were considered and skipped: numbered acceptance criteria and
test names that cite them give most of the traceability without the tooling.
