---
description: Documentation structure conventions for AGENTS.md and README.md
---

## AGENTS.md: Path-Scoped, Not Monolithic

Split AGENTS.md into per-directory files. Each file covers only what's relevant when working in that path.

- **Root `AGENTS.md`**: Minimal — repo overview, stow mechanics, global conventions, anti-patterns, tool index. Point to subdirectory docs.
- **Subdirectory `AGENTS.md`**: Path-specific config, gotchas, keybindings, anti-patterns. No global info duplication.
- Current subdirectories with AGENTS.md: `nvim/`, `docker/docker-services/`, `bashrc/`, `tmux/`, `wt/`

## README.md: Human-Facing Entry Point

- Include an "Architecture Decisions" section explaining *why* tools were chosen, not just *what* they are
- Numbered setup steps from prerequisites to running services
- Repository structure tree at the bottom

## CONVENTIONS.md: Actionable Rules

- Include specific tool commands (e.g., `mise run stylua`) not just "format your code"
- Volume label semantics for Docker (`:U,z`, `:ro,z`, `:ro`)
