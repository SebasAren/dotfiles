---
name: jj
description: Correct patterns for using jj (jujutsu) version control. Load this when you need to create revisions, move between changes, or perform any jj operation. Complements the commit skill (which handles commit-time concerns like message generation and rule reflection).
---

# jj Patterns

## Core Mental Model

jj has **no staging area**. Every file change in the working copy is already part of the current revision (called the "working copy change"). There is no `git add` step.

Key implication: `jj new` doesn't just create a new branch — it **finalizes the current working copy change** and opens a fresh empty one on top.

## Anti-Pattern: Empty Commits

The most common mistake is creating empty revisions by running `jj new` and `jj commit` in sequence without understanding what each does.

### How it goes wrong

```
# Agent modifies files (changes are in the working copy change)
# Then runs:
jj new -m "feat: add something"
# This creates a NEW empty revision on top.
# The modifications are now in the revision BELOW — not in the new one.

jj commit -m "feat: add something"
# Nothing to commit — the new working copy is empty.
# Result: an empty commit, or an error.
```

### The correct pattern

**Scenario A — You have changes and want to commit them:**
```bash
jj commit -m "feat: add something"
```
That's it. `jj commit` finalizes the current working copy change with a message. No `jj new` needed.

**Scenario B — You want to start fresh work on top of the current state:**
```bash
jj new -m "wip: next task"
```
This creates a new empty revision. Now make your changes — they'll accumulate in this new revision. When done, commit or `jj new` again.

**Scenario C — TDD workflow (start a step, do work, commit at the end):**
```bash
jj new                    # open new revision for this step
# ... write tests, write code ...
jj commit -m "feat(scope): description"  # finalize
```

### Decision rule

| Situation | Command |
|-----------|---------|
| Changes exist, time to commit | `jj commit -m "..."` |
| No changes yet, starting new work | `jj new -m "..."` |
| Just committed, starting next step | `jj new` (no `-m` needed — message comes at commit time) |

**Never run `jj new` followed immediately by `jj commit`.** That always produces an empty commit.

## Before Running jj Commands

Always check current state first:

```bash
jj log -r '@ | @-' --limit 2
jj diff --stat
```

- If `jj diff` shows changes → those are in the current revision (`@`).
- If `@` has changes, `jj commit` will finalize them. `jj new` will tuck them into `@` and open a new empty `@` on top.
- If `@` is empty, `jj commit` does nothing useful. You probably want `jj new` or just start working.

## Common Operations

### View current revision
```bash
jj log --limit 5
```

### Undo last operation
```bash
jj undo
```

### Amend the current revision (add more changes to it)
```bash
# Just edit files — changes automatically go into @ (the working copy change)
# No extra command needed. The working copy IS the current revision.
```

### Squash recent revisions together

```bash
jj squash             # squash @ (working copy) into @- (parent)
jj squash -r <rev>    # squash a specific revision into its parent
```

**Squashing a range of commits into one:** Use `--from` to move changes from a specific revision into the current revision (`@`). Repeat for each commit in the range.

```bash
# Move to the base where you want all changes to land
jj edit <base-revision>

# Squash each feature commit into @
jj squash --from <rev-1>     # moves rev-1's changes into @
jj squash --from <rev-2>      # moves rev-2's changes into @

# Now @ has all changes combined. Set the final message.
jj describe -m "feat(scope): combined feature description"

# Abandon any empty descendants left behind
jj abandon <empty-descendant>
```

**Handling the interactive editor:** When both source and destination have non-empty descriptions, `jj squash` opens an editor to ask which description to keep. To skip the editor:

```bash
jj squash --from <rev> --use-destination-message   # keep destination's description
jj squash --from <rev> -m "combined message"        # supply a new description inline
```

**Important:** `jj squash` without `--from` squashes `@` into `@-` (working copy into parent). Use `--from <child-rev>` to squash a child into `@` instead.

### Edit a previous revision
```bash
jj edit <revision-id>
# Make changes — they go into that revision
jj edit @-       # go back to working on the tip
```

## Relationship to Other Skills

- **commit skill** — handles commit-time reflection (findings, rules) and message generation. Use it when the user says "commit" or after completing work.
- **This skill (jj)** — handles the mechanics of jj operations. Use it when you need to create, move between, or manage revisions.
- **tdd-plan skill** — orchestrates the TDD loop. It calls `jj new` at step start and `jj commit` at step end following the patterns above.
