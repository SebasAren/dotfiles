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

See `.claude/rules/tmux.md` for full tmux gotchas (popup PATH, `display-popup -d` vs `-c`, fzf bash arrays, `wt-common.sh` error swallowing, fzf `--disabled`, `wt switch --no-cd`).
