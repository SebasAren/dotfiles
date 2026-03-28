# Qtile AGENTS.md

## OVERVIEW
Qtile window manager configuration with hostname-aware autostart, custom Wireplumber volume widget, and dual status bars.

## STRUCTURE
```
config.py          # Main entry: hostname detection, groups, keys, layouts, screens
__init__.py
autostart/
  ├── home.sh      # xrandr dual-monitor setup (DP-3 primary + HDMI-1)
  ├── work.sh      # Empty stub (work-specific setup goes here)
  └── base.sh      # picom, dunst, nm-applet
utils/
  ├── bars.py      # task_bar() and top_bar() factories returning Bar widgets
  └── process.py   # run_script() helper for autostart
widgets/
  └── wireplumber.py  # WireplumberVolume widget extending Volume
```

## AUTOSTART PATTERN
Hostname detection via `socket.gethostname()` with `HOME = "henk"` and `WORK = ""` constants.
The `autostart_once` hook runs hostname-specific script, then always runs base.sh:

```python
if hostname == HOME:
    run_script("./autostart/home.sh")
if hostname == WORK:
    run_script("./autostart/work.sh")
run_script("./autostart/base.sh")
```

## KEYBINDING STYLE
- Mod4 (Super) as primary modifier
- MonadTall layout keys: h/l shrink/grow main pane, j/k navigate, shift+h/l swap
- Media keys for wpctl volume (XF86AudioRaise/Lower/Mute)
- Rofi for app launching (mod+p, mod+shift+p)

## GROUPS
- "a", "b", "c", "comm" - regular groups
- "float" - Steam floating match: `Match(wm_class="Steam")`

## LAYOUTS
- MonadTall (primary)
- Max
- Floating

## CUSTOM WIDGETS
- `WireplumberVolume` in `widgets/wireplumber.py` - wraps Volume with wpctl, click opens qpwgraph

## ANTI-PATTERNS
- NO `vim.` calls - pure Python config
- NO async/await
- NO wildcard imports
- Do not modify HOME/WORK hostname constants without matching autostart scripts
