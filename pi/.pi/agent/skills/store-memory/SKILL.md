---
name: store-memory
description: Dump conceptual observations, insights, and patterns to the wiki inbox (~/Documents/wiki/raw/inbox/) as timestamped markdown files. The agent decides autonomously when to store. Use when you discover something worth persisting — an insight, a pattern, a design rationale, or a conceptual observation.
---

# Store Memory to Wiki

Autonomously persist conceptual observations to `~/Documents/wiki/raw/inbox/` as timestamped markdown files. The obsidian-wiki-ingest skill processes inbox contents into the structured wiki later.

## Trigger

**Store autonomously** — no permission needed. Write a memory note whenever you encounter something worth persisting:

- **Insights** — a design decision makes sense now, a pattern becomes clear
- **Conceptual observations** — understanding of a system's architecture, trade-offs, or rationale
- **Reusable patterns** — approaches that worked well across multiple files or contexts
- **Design rationale** — why something was built a certain way (not just what it does)
- **Surprising behavior** — non-obvious system behavior worth remembering

**Do NOT store** (these go to `.claude/rules/`):

- Code-specific gotchas (syntax quirks, API misuses, import patterns)
- Project conventions (indentation, naming, testing setup)
- Framework-specific workarounds
- Error messages and their fixes

## Format

### File Naming

```
YYYY-MM-DD-descriptive-slug.md
```

Examples:
- `2026-04-25-agent-architecture-insights.md`
- `2026-04-25-worktree-scope-rationale.md`

The date prefix is today's date. The slug is derived from the title (lowercased, non-alphanumeric characters replaced with hyphens).

### Frontmatter

```yaml
---
title: Descriptive Title
created: 2026-04-25T15:30:00.000Z
tags:
  - agents
  - architecture
---
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Human-readable title of the observation |
| `created` | Yes | ISO 8601 timestamp of creation |
| `tags` | Yes | Array of kebab-case tags for discoverability |

### Content Body

The body is free-form markdown. Write clearly but concisely. Use headings, lists, and code blocks as needed.

## Content Boundary

| → Wiki inbox (store-memory) | → .claude/rules/ (commit skill) |
|-----------------------------|--------------------------------|
| Conceptual insights | Code gotchas |
| Architecture rationale | Syntax quirks |
| System understanding | Import patterns |
| Design trade-offs | API workarounds |
| Patterns across files | Project conventions |
| Non-obvious behavior details | Error message fixes |

**Test:** "Would this help someone understand the system, or would it help someone avoid a mistake while coding?" The former → wiki. The latter → `.claude/rules/`.

## Examples

Good memory notes:
- "The explore extension uses synthetic documents for reranking because the first 500 chars of source files are mostly imports"
- "The worktree-scope extension blocks writes via a hard block in the tool validation layer, not via git"
- "Design decision: no snippet injection into reranker documents — it biased the subagent toward wrong guesses"

Bad memory notes (belong in `.claude/rules/`):
- "Always use `spawnSync` with array args, never shell strings"
- "Bun 1.3.x doesn't have `Bun.escapeShellArg`"
- "Use `import { mock } from 'bun:test'` before importing modules"

## Usage

### Via CLI (preferred)

Use the `store-memory` CLI tool via the bash tool:

```bash
# With inline content
store-memory --title "My Observation" --tags agents,architecture "The agent observes that the worktree scope..."

# With stdin
echo "The pattern of using synthetic documents for reranking..." | store-memory --title "Reranking Approach" --tags patterns,search
```

### Via write tool (fallback)

If the CLI tool is unavailable, write the file directly using the write tool with correct YAML escaping:

```markdown
---
title: "My Observation"
created: 2026-04-25T15:30:00.000Z
tags:
  - agents
---

Content here...
```

Use the current ISO 8601 timestamp for `created`. Always double-quote the `title` value to prevent YAML parsing issues with colons or special characters.

### Via skill invocation

```
/skill:store-memory
```

Agent autonomously decides when to store — no manual invocation needed.
