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

Combined workflow: create worktree → run pi → merge back.

```bash
wpi <branch-name> [pi-args...]
```

1. Creates worktree via `wt switch --create` (or switches if it exists)
2. Runs `pi` with provided args — includes hint not to call `wt merge`
3. After pi exits, prompts to merge back to source branch
4. If merge fails: reopens pi with full error context, then retries on confirmation

The merge loop (`_wpi_merge_loop`) strips ANSI from output for clean pi prompts.

## Conventions

- One concern per file
- `set -euo pipefail` in scripts
- Use `command -v` to check tool availability
- Shell functions override binaries by storing the real path in `_toolname_bin`
