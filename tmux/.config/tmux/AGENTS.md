# Tmux Configuration

## Config

Single file: `tmux.conf`. TPM auto-bootstraps on first run (clones plugins).

Prefix: `Ctrl+a` (not default `Ctrl+b`).

## Keybindings

Most bindings use `Alt` directly — no prefix needed.

| Key | Action |
|-----|--------|
| `Alt+h/j/k/l` | Navigate panes |
| `Alt+v` / `Alt+s` | Split horizontal / vertical |
| `Alt+n` | New window |
| `Alt+1..9` | Switch to window N |
| `Alt+</>` | Reorder windows |
| `Alt+{` / `Alt+}` | Swap panes |
| `Alt+z` | Zoom pane |
| `Alt+Space` | Cycle layouts |
| `Alt+H/J/K` | Resize panes (5 cells) |
| `Alt+Shift+H/J/K` | Resize panes |
| `prefix+r` | Reload config |
| `prefix+W` | Create worktree (popup) |
| `prefix+w` | Switch worktree (popup) |
| `prefix+X` | Remove worktree (popup) |
| `prefix+J` | Join pane from another window |

Vi copy mode: `v` to select, `y` to yank to clipboard (`wl-copy`).

## Plugins (TPM)

- `tmux-plugins/tpm` — plugin manager
- `tmux-plugins/tmux-sensible` — sane defaults
- `tmux-plugins/tmux-yank` — clipboard integration (`wl-copy`)
- `fabioluciano/tmux-tokyo-night` — theme (`@theme_variation 'night'`)

Install/update: `prefix+I`

## Popup Scripts (`scripts/`)

Worktree management via tmux popups. All scripts source `wt-common.sh` which:
- Ensures linuxbrew is in PATH (`/home/linuxbrew/.linuxbrew/bin/brew shellenv`) — `wt` binary won't be found inside `display-popup` otherwise
- Sets Tokyo Night fzf colors

| Script | Trigger | What it does |
|--------|---------|--------------|
| `wt-create.sh` | `prefix+W` | fzf branch picker → creates worktree → opens tmux window |
| `wt-switch.sh` | `prefix+w` | fzf worktree list → opens tmux window at worktree path |
| `wt-remove.sh` | `prefix+X` | fzf worktree list → removes worktree → kills tmux window |
| `wt-open-create.sh` | (called by wt-create.sh) | Runs `wt switch --create` inside new window |

## Gotchas

- **Popup PATH**: `display-popup` starts a non-login shell. linuxbrew tools (`wt`, `fzf`) need explicit PATH setup — handled by `wt-common.sh`.
- **`-d` vs `-c`**: `display-popup -d` sets start directory. `-c` is `target-client` and causes errors if used with a path.
- **fzf arrays**: When building fzf args with special characters (Unicode prompts like `▸`), use bash arrays not `echo + $(...)` — word splitting breaks them.
- **`wt-common.sh` error swallowing**: `_wt_worktree_list()` does `2>/dev/null || echo "[]"` — empty list might mean `wt` failed, not "no worktrees."
- **fzf free-text input**: Use `--disabled` flag when using fzf for text entry (not selection) — otherwise typing text causes exit code 1 when filtering yields 0 matches.
- **`wt switch --create` in scripts**: Needs `--no-cd` in subprocesses — `wt switch` tries to `cd` the calling shell, which doesn't propagate through bash subprocesses.
