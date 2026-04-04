---
name: wt
description: Manage git worktrees with the worktrunk (wt) CLI. Use when creating, switching, listing, merging, or removing worktrees; reviewing branch status; or performing parallel AI agent workflows with git worktrees.
---

# Worktrunk (wt) Skill

Git worktree management for parallel AI agent workflows. Worktrunk (`wt`) manages isolated working directories for different branches, enabling concurrent work without stashing or cloning.

## When to Use This Skill

- User mentions "worktree", "wt", or "worktrunk"
- User wants to work on multiple branches in parallel
- User wants to create, switch, list, merge, or remove worktrees
- User wants to review branch status across worktrees
- User asks about the wt configuration, hooks, or step commands
- User wants to integrate changes from a feature branch back to main

## Essential Commands

### Switch / Create Worktrees

```bash
wt switch feature-auth           # Switch to existing worktree
wt switch -                      # Previous worktree (like cd -)
wt switch --create new-feature   # Create new branch + worktree
wt switch --create hotfix --base production  # From specific base
wt switch ^                      # Default branch (main/master)
wt switch pr:123                 # GitHub PR #123's branch
wt switch mr:101                 # GitLab MR !101's branch
```

### List Worktrees

```bash
wt list                          # Show all worktrees with status
wt list --full                   # Include CI, diff analysis, LLM summaries
wt list --branches               # Include branches without worktrees
wt list --format=json            # JSON output for scripting
```

### Merge Back to Default Branch

```bash
wt merge                         # Squash-merge current branch into default
wt merge develop                 # Merge into specific target
wt merge --no-squash             # Preserve individual commits
wt merge --no-remove             # Keep worktree after merge
wt merge --no-ff                 # Create merge commit (semi-linear)
```

### Remove Worktrees

```bash
wt remove                        # Remove current worktree (deletes branch if merged)
wt remove feature-branch         # Remove specific worktree
wt remove --no-delete-branch     # Keep the branch
wt remove -D experimental        # Force-delete unmerged branch
wt remove --force                # Remove even with untracked files
```

### Individual Steps (Manual Merge Pipeline)

```bash
wt step commit                   # Stage + commit with LLM-generated message
wt step squash                   # Squash commits since branching
wt step rebase                   # Rebase onto target
wt step push                     # Fast-forward target to current branch
wt step diff                     # Show all changes since branching
wt step copy-ignored             # Copy gitignored files to another worktree
wt step for-each -- <command>    # Run command in every worktree
wt step prune                    # Remove merged worktrees
```

### Hooks

```bash
wt hook show                     # Show configured hooks
wt hook pre-merge                # Run pre-merge hooks manually
wt hook pre-merge test           # Run specific named hook
wt hook approvals                # Manage command approvals
```

### Configuration

```bash
wt config create                 # Create user config (~/.config/worktrunk/config.toml)
wt config create --project       # Create project config (.config/wt.toml)
wt config show                   # Show all config files and locations
wt config shell install          # Set up shell integration (directory switching)
```

## Key Concepts

### Worktree Path Resolution

Worktrees are addressed by **branch name**, not path. Paths are computed from a configurable template. Default layout: sibling directories (`~/code/myproject.feature-auth`).

Configure in `~/.config/worktrunk/config.toml`:
```toml
worktree-path = "{{ repo_path }}/.worktrees/{{ branch | sanitize }}"
```

### Branch Shortcuts

| Shortcut | Meaning |
|----------|---------|
| `^` | Default branch (main/master) |
| `@` | Current branch/worktree |
| `-` | Previous worktree |
| `pr:{N}` | GitHub PR #N's branch |
| `mr:{N}` | GitLab MR !N's branch |

### Status Symbols (wt list)

Key symbols in the Status column:

| Symbol | Meaning |
|--------|---------|
| `+` | Staged files |
| `!` | Modified (unstaged) |
| `?` | Untracked files |
| `✘` | Merge conflicts |
| `^` | Is the default branch |
| `⊂` | Content integrated into default (safe to delete) |
| `_` | Same commit as default, clean |
| `↕` | Diverged from default |
| `↑` | Ahead of default |
| `↓` | Behind default |
| `\|` | In sync with remote |
| `⇡` | Ahead of remote |
| `⇣` | Behind remote |

Dimmed rows are safe to delete (merged or same commit with clean tree).

### Merge Pipeline

`wt merge` runs automatically: commit → squash → rebase → pre-merge hooks → merge → cleanup. Use individual `wt step` commands for manual control with review between steps.

### Hooks Lifecycle

| Hook | Type | Best For |
|------|------|----------|
| `pre-start` | Blocking | Dependency install, env setup |
| `post-start` | Background | Dev servers, builds, file watchers |
| `pre-commit` | Blocking | Formatters, linters |
| `pre-merge` | Blocking | Tests, security scans |
| `post-merge` | Background | Deployment, notifications |
| `pre-remove` | Blocking | Save artifacts before deletion |
| `post-remove` | Background | Stop servers, clean containers |

### Template Variables for Hooks

Common variables: `{{ branch }}`, `{{ worktree_path }}`, `{{ repo }}`, `{{ default_branch }}`, `{{ hash_port }}`.

Filters: `{{ branch | sanitize }}` (filesystem-safe), `{{ branch | sanitize_db }}` (DB-safe), `{{ branch | hash_port }}` (port 10000-19999).

## Agent Workflow Patterns

### Pattern: Start Feature on New Worktree

```bash
wt switch --create feature-name
# Work in the new worktree...
wt list   # Check status
wt step diff  # Review changes
wt merge  # Squash-merge back to default
```

### Pattern: Review and Merge from Another Worktree

```bash
wt list --full          # See status of all branches including CI
wt step diff feature-name  # Review changes (from any worktree)
wt switch feature-name  # Go to the feature worktree
wt merge                # Merge and clean up
```

### Pattern: Parallel Agent Work

```bash
wt switch --create agent-task-1
wt switch --create agent-task-2
# Each agent works in its own worktree
wt list                 # Monitor progress
wt merge                # Merge completed work
```

### Pattern: Inspect Branch State (JSON for Scripting)

```bash
# Current worktree path
wt list --format=json | jq -r '.[] | select(.is_current) | .path'

# Branches with uncommitted changes
wt list --format=json | jq '.[] | select(.working_tree.modified)'

# Branches ahead of main (needs merging)
wt list --format=json | jq '.[] | select(.main.ahead > 0) | .branch'

# Integrated branches (safe to remove)
wt list --format=json | jq '.[] | select(.main_state == "integrated") | .branch'

# Worktrees with merge conflicts
wt list --format=json | jq '.[] | select(.operation_state == "conflicts")'
```

## Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| User config | `~/.config/worktrunk/config.toml` | Personal: path template, LLM, hooks |
| Project config | `.config/wt.toml` | Shared: project hooks, dev URL |
| Approvals | `~/.config/worktrunk/approvals.toml` | Approved project hook commands |

## Notes

- Shell integration (`wt config shell install`) is needed for `wt switch` to change the shell's working directory
- Without shell integration, `wt switch` prints the target directory but cannot `cd`
- `wt merge` merges current INTO target (like GitHub "Merge PR"), not the reverse
- Branch cleanup after remove checks 6 conditions including squash-merge detection
- Use `--no-verify` to skip hooks, `-y` to skip approval prompts
- Use `-v` for verbose output (hooks, templates), `-vv` for debug reports

## Reference

Full documentation: https://worktrunk.dev
GitHub: https://github.com/max-sixty/worktrunk
