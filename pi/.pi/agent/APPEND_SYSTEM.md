# jj (jujutsu) Version Control

This project uses **jj** as extra porcelain on top of git. jj is the primary interface for commits, logs, and history manipulation. The underlying `.git` directory is still present.

## Conventions

- **Use jj commands** instead of git for commits, logs, and history manipulation (`jj commit`, `jj log`, `jj squash`, `jj undo`, etc.)
- **Conventional commits required** — all commit messages must follow `<type>(<scope>): <description>` format
- **Pre-commit hook** runs `mise run pre-commit` (format + lint + typecheck + test) on `jj commit`
- **No worktrees** — this project does not use git worktrees. All work happens in a single working directory

## TDD Workflow

- `jj new` at the start of each TDD step (creates empty revision)
- `jj commit -m "<conventional commit message>"` at step end (moves working copy changes into the revision)
- At plan end, squash all step revisions into one commit manually via `jj squash`

## Commit Messages

Generated via the Pi LLM with the same conventional commit prompt as `generate-commit-msg.sh`. The commit skill handles message generation and `jj commit`.
