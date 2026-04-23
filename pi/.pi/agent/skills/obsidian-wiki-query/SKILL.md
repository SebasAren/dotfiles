---
name: obsidian-wiki-query
description: Look up information in the personal wiki at ~/Documents/wiki/. Use when the user asks a question that the wiki might cover — AI models, agentic coding, spec-driven development, tooling, or any topic previously ingested. Also use with /skill:obsidian-wiki-query <question>.
---

# Query the Wiki

Answer questions from the wiki at `~/Documents/wiki/`. The wiki is a general-purpose, LLM-maintained knowledge base. All domains are welcome — not just AI/LLM topics.

## Search Algorithm

Follow these steps in order. Stop when you have enough to answer.

### Step 1 — Index lookup

Read `~/Documents/wiki/wiki/index.md`. Check for exact or close matches in the Concepts, Entities, Sources, and Synthesis sections. This is the fastest path for known topics.

### Step 2 — Full-text search

If the index didn't surface the right pages, search page content:

```bash
wiki-search "<keywords>"
```

This searches all wiki pages with `rg` and shows matching files plus context lines.

For manual control:
```bash
rg -il "<keyword>" ~/Documents/wiki/wiki/          # list matching files
rg -i -C 2 "<phrase>" ~/Documents/wiki/wiki/       # context around matches
```

Try multiple search terms — the wiki uses specific terminology (e.g., "agent swarm" not "multi-agent AI", "spec-driven development" not "requirements engineering").

### Step 3 — Follow wiki links

Pages use `[[wiki-link]]` cross-references. When a matching page links to related pages that are also relevant, read those too. This is the "multi-hop" — the wiki's link graph often surfaces context the initial search missed.

### Step 4 — Synthesize

Synthesize the answer with `[[wiki links]]` citations. If the answer is valuable (comparison, analysis, discovery), ask the user whether to save it as `wiki/analysis/<slug>.md`.

## Wiki Page Types

| Directory | Content |
|-----------|---------|
| `wiki/concepts/` | Topic pages — definitions, properties, comparisons |
| `wiki/entities/` | People, orgs, tools, models — concrete things |
| `wiki/sources/` | Source summaries — what was ingested and key takeaways |
| `wiki/synthesis/` | High-level overviews spanning multiple sources |
| `wiki/analysis/` | Filed-back answers, comparisons, explorations |

## Tips

- Start with the index. It's a catalog of every page with one-line summaries.
- Use `wiki-search` for topical searches when you don't know the exact page name.
- The synthesis pages (`wiki/synthesis/`) are the broadest — check them for overviews.
- If you find nothing relevant, say so. Don't fabricate wiki content.
