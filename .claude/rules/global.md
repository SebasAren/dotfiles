---
description: Global project conventions — sebbashop, docs structure, and language standards
---

## Stow Packages (GNU Stow)

- Files in `tool-name/.config/tool/` are symlinked to `~/.config/tool/`
- Always edit files in the repo, never in the symlink target
- Use conventional commits, atomic changes
- Do NOT add qutebrowser config — it does not exist despite docs references

## Documentation Structure

**AGENTS.md**: Path-scoped, not monolithic. Root AGENTS.md is minimal (overview, conventions, tool index). Subdirectory AGENTS.md covers path-specific config and gotchas only — no global info duplication.

**README.md**: Human-facing entry point. Include architecture decisions (why, not just what), numbered setup steps, and repo structure tree.

**CONVENTIONS.md**: Actionable rules with specific tool commands (e.g., `mise run stylua`), not vague guidance.

## Language Conventions

**Lua** (2-space indent, StyLua): `snake_case` vars/funcs, `---@type` annotations, `vim.keymap.set` over legacy API, `pcall` for optional requires.

**Python** (4-space indent, ruff): `snake_case` funcs/vars, `PascalCase` classes. Use ruff for linting, black + isort for formatting.

**Shell**: `set -euo pipefail`, one concern per file, lowercase-hyphen filenames.

**TypeScript/Bun**: Use `spawnSync` with array args (no shell escaping needed). Do not use `Bun.escapeShellArg` (undefined in Bun 1.3.x) or `Bun.makeTempDir` (doesn't exist) — use `mkdtempSync` from `node:fs` instead.

## Stow Safety

- Add a `.stowrc` at the repo root with `--target=<home-dir>` and `--ignore=` for non-stowable root files. Prevents accidental `stow */` from pointing to wrong targets.

## Shellcheck in `.bashrc.d`

These files intentionally omit `set -euo pipefail` (they are sourced interactively), but still fix these recurring warnings:
- **SC2155**: `export VAR=$(cmd)` → `VAR=$(cmd); export VAR`
- **SC2162**: `read env_key` → `read -r env_key`
- **SC2054**: `FZF_OPTS=(a,b)` → `FZF_OPTS=(a b)` (arrays use spaces, not commas)
