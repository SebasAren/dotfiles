# Tmux Configuration

## Setup

```bash
stow tmux
tmux  # TPM auto-installs plugins on first run
```

## Prefix

`Ctrl+a` (instead of default `Ctrl+b`)

## Keybindings

### No prefix needed

| Key | Action |
|-----|--------|
| `Alt+h/j/k/l` | Navigate panes (left/down/up/right) |
| `Alt+1..9` | Switch to window by number |

### With prefix (`Ctrl+a`)

| Key | Action |
|-----|--------|
| `\|` | Split horizontally |
| `-` | Split vertically |
| `c` | New window |
| `H/J/K/L` | Resize pane (repeatable) |
| `r` | Reload config |
| `I` | Install TPM plugins |
| `U` | Update TPM plugins |

### Copy mode (enter with `prefix+[`)

| Key | Action |
|-----|--------|
| `v` | Begin selection |
| `y` | Yank selection |

## Plugins

- **tmux-sensible** — community defaults
- **tmux-yank** — system clipboard support
- **tokyo-night** — theme (matches nvim)
