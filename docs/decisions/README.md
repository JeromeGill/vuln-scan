# Decisions

Short records of choices a future reader might otherwise question or undo,
one file per decision. The file name is the decision's title as a slug
(`typescript-held-at-6x.md`), so two branches adding decisions never touch
the same file. There is no list to keep up: the folder is the index, and
`git log --diff-filter=A --format=%as --name-only -- docs/decisions` shows
when each was added.

## Adding one

1. Create `docs/decisions/<slug>.md` with the decision as its `#` heading,
   then a few paragraphs: what was chosen, what else was considered, and
   why.
2. Link to it from the docs page it explains
   (`[Decisions](decisions/<slug>.md)`).

When a decision changes, edit its file, or write a new one and say at the top
of the old one which decision replaces it. Don't rename a file once other
pages link to it.
