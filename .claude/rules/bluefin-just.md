---
description: Bluefin ujust custom recipe conventions
---

- `ujust` only imports custom recipes from `/usr/share/ublue-os/just/60-custom.just` (immutable `/usr` partition)
- `~/.config/ublue-os/justfile` is NOT picked up by `ujust` — use shell aliases instead for user-level commands
- To add custom ujust recipes, create `/usr/share/ublue-os/just/60-custom.just` manually (survives updates but is manual)
- System Brewfiles live at `/usr/share/ublue-os/homebrew/*.Brewfile` — diff against these when creating personal Brewfiles
- `brew leaves` gives top-level (explicitly installed) formulas, excluding dependencies
