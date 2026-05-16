---
name: pitchfork
description: Query code quality status from pitchfork background watchers (tests, lint, typecheck, format). Use when you want to check if tests pass, code is formatted, or lint is clean — without running checks manually.
---

# Pitchfork Quality Watchers

Pitchfork manages background daemons that run code quality checks on file change. Use it to check status instead of running quality commands manually.

## When to Use This Skill

- Checking if tests/lint/typecheck/format pass after making changes
- Getting a quality report before committing
- Any time you'd normally run test/lint/typecheck commands manually

## Discovering Daemons

Daemons are defined per-project in `pitchfork.toml`. Before checking status, discover what's available:

```bash
pitchfork list
```

This shows all daemons, their status (running/stopped), and their health. You can also read `pitchfork.toml` in the project root to understand what each daemon checks.

## Quick Check

Always use `--since` to avoid stale logs from previous runs:

```bash
pitchfork logs <daemon> --raw --since 5min
```

If logs seem stale, clear them and re-run:

```bash
pitchfork logs --clear && pitchfork start --all
```

## Commands

```bash
# Start all watchers (auto-starts when cd'ing into repo if shell hook is active)
pitchfork start --all

# Check status — are daemons running?
pitchfork list

# Read latest output from a specific daemon
pitchfork logs <daemon> --raw -n 50

# Read all logs at once
pitchfork logs --raw -n 30

# Restart a daemon (e.g. if results seem stale)
pitchfork restart <daemon>

# Stop all
pitchfork stop --all
```

## Interpreting Output

**Empty output = clean.** If `pitchfork logs <daemon> --raw --since 5min` shows nothing, the last run passed with no issues.

If output exists, read the raw logs directly:
- **Test runners**: Look for `FAIL` / `PASS` summary at the bottom
- **Linters**: Exits with error count, issues listed by file
- **Type checkers**: `error TS...` or similar error lines
- **Format checkers**: Lists files that need formatting

If a daemon isn't running, start it: `pitchfork start <name>`. If results seem stale, restart it: `pitchfork restart <name>`.

## Workflow

1. Make changes to files
2. Check quality: `pitchfork logs <daemon> --raw --since 5min`
3. If issues found, fix them
4. Re-check after fix (watchers auto re-run on file change)
5. Commit when green

## Avoiding Stale Logs

Pitchfork logs are append-only — old errors persist even after fixes. To get clean feedback:

- **Always use `--since`** (e.g. `--since 5min`, `--since 1h`) to filter to recent runs
- **Clear history** with `pitchfork logs --clear` before starting a fresh session
- **Empty output = success** — no lines means the daemon ran clean
