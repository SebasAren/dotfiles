---
name: obsidian-wiki-maintain
description: Maintain the health of the personal wiki at ~/Documents/wiki/. Use for lint checks (contradictions, orphans, stale claims), wiki status reports, and structural maintenance. Invoke with /skill:obsidian-wiki-maintain <lint|status>.
---

# Maintain the Wiki

Health checks and maintenance for the wiki at `~/Documents/wiki/`.

## Wiki Status

**Trigger:** `/skill:obsidian-wiki-maintain status`

Report:
- Page count by category (`find wiki/concepts/ -name '*.md' | wc -l`, etc.)
- Most recent ingest date from `grep "^## \[" wiki/log.md | tail -1`
- Last 5 log entries: `grep "^## \[" wiki/log.md | tail -5`
- Inbox contents: `ls raw/inbox/`
- Topical coverage overview: use `wiki-search` to spot-check coverage on key topics
- Any obvious issues

## Lint the Wiki

**Trigger:** `/skill:obsidian-wiki-maintain lint`

Run these checks:

| Check | How |
|-------|-----|
| **Orphan pages** | Pages with no inbound `[[links]]` from other wiki pages. Use `wiki-search "<page title>"` to check for mentions, or fall back to `rg -l 'pagename' wiki/`. |
| **Missing cross-refs** | Pages that mention concepts/entities without `[[linking]]` them. |
| **Concepts without pages** | Terms mentioned in `[[links]]` where the target file doesn't exist. `rg -o '\[\[([^\]]+)\]\]' wiki/ | sort -u` then check each. |
| **Contradictions** | Claims on different pages that conflict. Flag with `> ⚠️ Contradicts [[page]]: ...` |
| **Stale claims** | Older pages superseded by newer sources. |
| **Log/Index drift** | Pages in log.md not in index.md or vice versa. |
| **Inbox orphans** | Files in `raw/inbox/` older than a few days. |

Report findings as a checklist. For each issue, suggest a fix. Ask which to apply, then apply them.

## Conventions

- `[[wiki links]]` for all cross-references
- Filenames: `lowercase-with-dashes`
- Mark contradictions: `> ⚠️ Contradicts [[page]]: description`
- Update `index.md` and `log.md` after any structural changes
