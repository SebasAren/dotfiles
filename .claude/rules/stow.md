---
description: Stow package gotchas — symlinks, AGENTS.md conflicts, and stowable scripts
---

- **AGENTS.md conflicts with stow**: Root-level `AGENTS.md` in a stow package gets symlinked to `~/AGENTS.md`. When multiple packages have one, stow fails with a conflict. Add `AGENTS\.md` to each package's `.stow-local-ignore`. Currently `bashrc/` and `homebrew/` have ignores; add one to any new package that gets an `AGENTS.md`.
- **Stowable scripts go in `<pkg>/.local/bin/`**: Files at `<pkg>/.local/bin/<name>` stow to `~/.local/bin/<name>`, which is already in PATH. No aliases or PATH changes needed. Drop the `.sh` extension — the filename becomes the command name.
- **`.stow-local-ignore` is per-package**: Each stow package needs its own ignore file. It uses Perl regexes (e.g., `AGENTS\.md`), one pattern per line.
