# Bash Configuration

Modular shell config. Entry point: `.bashenv` (global vars), then all files in `.bashrc.d/` are sourced.

## Structure

```
.bashenv              # Global env vars (EDITOR, XDG_CONFIG_HOME)
.bashrc.d/
  config              # Sources .bashenv, fzf key bindings
  alias               # Short aliases
  mise                # Activates mise runtime manager
  secrets             # Lazy Proton Pass integration
  tmux                # Auto-attach/create tmux sessions
  wt                  # Worktrunk shell wrapper (directive file pattern)
  wpi                 # Worktree + Pi agent workflow
  wt-hooks            # Sources mise for hook scripts
  fnox                # fnox reencryption helper
.secrets.tpl          # Template for secret injection
```

## Secrets (`secrets`)

Lazy resolution via Proton Pass CLI. API keys are **not** loaded on shell startup.

- `pass-cli` is wrapped: only `login`/`logout` subcommands allowed directly
- `_ensure_secrets` resolves `~/.secrets.tpl` via `pass-cli inject` on first call
- `nvim` and `pi` are wrapped to call `_ensure_secrets` before launching
- `wt` calls `_ensure_secrets` in its own wrapper (in the `wt` file)

Template format (`~/.secrets.tpl`):
```bash
export EXA_API_KEY='{{ pass://API/Exa/API Key }}'
export CONTEXT7_API_KEY='{{ pass://API/Context7/API Key }}'
```

## Worktrunk Wrapper (`wt`)

Overrides the `wt` binary with a shell function that uses a **directive file** pattern:

1. Runs `wt` with a temp file path in `WORKTRUNK_DIRECTIVE_FILE`
2. `wt` writes shell directives (like `cd`) to the temp file
3. Wrapper sources the file after `wt` exits
4. Supports `--source` flag to run from cargo (dev builds)
5. Lazy completions via `_wt_lazy_complete`

This is necessary because subprocesses can't modify their parent shell's working directory.

## Worktree + Pi (`wpi`)

TUI menu for the Worktree + Pi workflow. Built with `@mariozechner/pi-tui`.

```bash
wpi                      # show interactive TUI menu
wpi <branch-name> [..]   # full pipeline (backward compat)
wpi --attach <branch>    # resume interrupted session
```

### TUI Menu Stages

- **Create worktree** — `wt switch --create <branch>`
- **Start Pi** — launch pi AI agent in current worktree
- **Review** — open nvim diff review
- **Merge** — squash-merge back to source branch
- **Attach** — resume an interrupted session

### Architecture

- `wt/.local/bin/wpi` — bash shim: no args → TUI, with args → `wpi-backend`
- `wt/.local/bin/wpi-backend` — original bash script (full pipeline, `--attach`)
- `wt/.local/share/wpi-tui/` — TUI source (TypeScript, runs via `bun`)

The bashrc wrapper sources directive files from `wt` to propagate directory changes
to the parent shell, same as the original script.

## Conventions

- One concern per file
- `set -euo pipefail` in scripts
- Use `command -v` to check tool availability
- Shell functions override binaries by storing the real path in `_toolname_bin`
