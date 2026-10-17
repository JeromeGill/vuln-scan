# Plans

A plan is for work too big or too uncertain for a single story: a new
platform, a cross-cutting change to how the project is built or tested, or a
feature that needs design choices made before stories can be written. It
records the goal, the options, what was decided and why, and which stories
come out of it.

Smaller follow-ups, too small for a plan or a story, are
GitHub issues (`gh issue create`), closed from
the PR that does the work with `Fixes #N`.

Stories say _what_ the user gets and how to tell it's done. Plans say _how we
get there_ when that isn't obvious. Many features need no plan at all.

There is no index table to keep up (it made every plan PR conflict): the
folder is the list, and each plan's frontmatter holds its status. To see
them all:

```sh
grep -H -e "^title:" -e "^status:" docs/plans/[0-9]*.md
```

## Writing a plan

1. Pick the next free number. Check open PRs and other branches too
   (`gh pr list`, `git branch -a`), since a number in use there isn't free.
2. Copy [`_template.md`](_template.md) to `NNNN-short-slug.md` and set
   `status: draft`.
3. Commit it on a `docs/` branch (`docs(plans): add P-NNNN <title>`) and
   merge it to `main` in its own small PR before any work starts, so the
   number is taken; that's also the point of writing it down.

Statuses:

- `draft`: written down, not yet discussed or agreed.
- `investigating`: needs spikes or research before a choice can be made.
- `accepted`: the approach is agreed; its stories can be written.
- `done`: every story it lists is done and every PR in its PRs section is
  merged. The plan's file is then cut down to a stub (see below).
- `dropped`: decided against. The file stays so its number isn't reused.

Update the status in the plan's frontmatter as it moves. When a plan is accepted,
write its stories (see [Stories](../stories/README.md)) and list them in the
plan's Stories section. Record lasting choices in
[Decisions](../decisions/README.md) too, since plans describe intent and can go
stale once the work ships.

**Implemented plans are cut down to a stub.** Once a plan's work is merged,
move whatever is still worth knowing out of it (choices and their reasons to
[Decisions](../decisions/README.md), how things work to the docs pages, what
was built to its stories' Implementation sections), fix every link to it,
and replace its body with a line or two saying what it delivered and where
that now lives, usually in the PR that finishes the work. The stub keeps its
frontmatter with `status: done`, so the number isn't reused; git history
keeps the full text.
