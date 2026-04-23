---
name: obsidian-wiki
description: Operate on a local LLM-maintained Obsidian wiki. Ingest sources into raw/, answer queries against wiki/, lint for health. Invoke with /skill:obsidian-wiki <ingest|query|lint|status>.
---

# Obsidian Wiki Operator

Operate on Karpathy's LLM-wiki pattern — an LLM-maintained knowledge base in markdown, viewed through Obsidian. The wiki is a persistent, compounding artifact: every source ingest updates pages, cross-links entities, revises synthesis, and logs the history.

## Vault Layout

```
~/Documents/llm-wiki/
├── raw/                   # Immutable source documents (read only)
│   ├── inbox/             # Staging area — drop files/URLs here, agent moves them
│   ├── articles/          # Web articles, blog posts, news
│   ├── notes/             # Markdown notes, text files
│   ├── papers/            # Academic papers, PDFs
│   ├── videos/            # YouTube videos (transcripts only, via yt-dlp)
│   └── <custom>/          # Add more categories as needed (podcasts/, etc.)
├── wiki/                  # LLM-maintained knowledge base
│   ├── index.md           # Catalog of all wiki pages (updated every ingest)
│   ├── log.md             # Chronological activity log (append-only)
│   ├── overview.md        # High-level overview of the wiki domain
│   ├── concepts/          # Concept & topic pages
│   ├── entities/          # Entity pages (people, places, things)
│   ├── sources/           # Source summaries
│   ├── synthesis/         # High-level overviews and synthesis
│   └── analysis/          # Answers, comparisons, explorations filed back
└── SCHEMA.md              # Wiki structure & conventions definition
```

## Core Principles

1. **Raw sources are immutable** — never modify files in `raw/`. Read them; they are the source of truth.
2. **The wiki is LLM-owned** — create, update, link, and maintain all wiki pages.
3. **Cross-reference aggressively** — use `[[wiki links]]` for all cross-references. Every page should link to related concepts, entities, and sources.
4. **File valuable outputs back** — comparisons, analyses, discoveries should be saved as wiki pages, not left in chat history.
5. **Keep index.md and log.md current** — update them on every operation.
6. **Videos must be watched** — YouTube videos and video files in the inbox must always be transcribed and fully ingested. Never treat a metadata clip, excerpt, or auto-sub file as sufficient. The transcript must be downloaded (if needed), read, and processed into the wiki just like any other source.

## Operations

### Ingest a Source

**Trigger:** Say `ingest` (no path needed) — agent processes `raw/inbox/`.

Alternatively: `/skill:obsidian-wiki ingest <path-or-url>` for explicit paths.

#### Inbox Ingest Flow

1. **Detect inbox contents** — check `raw/inbox/` for files and any URLs mentioned in context.
2. **Classify and move** — assign each item to a category folder based on type:
   - `.pdf` → `raw/papers/`
   - `.md`, `.txt`, `.org` → `raw/notes/`
   - `.html`, `.htm` → `raw/articles/`
   - URLs, web content → `raw/articles/`
   - YouTube URLs (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`) → `raw/videos/`
   - `.mp4`, `.mkv`, `.webm` → `raw/videos/`
   - images (`*.png`, `*.jpg`, `*.gif`) → inline in wiki (or `raw/media/` if large)
   - Fallback: `raw/notes/` for unrecognized types
3. **Ingest each source** (steps below).
4. **Empty inbox** — inbox should be empty after ingest.

#### Ingest Steps

1. **Read the source.**
   - **Local file:** `read` it directly.
   - **URL (web):** `web_fetch` it.
   - **URL (YouTube):** Use `yt-dlp` to fetch the transcript. This is mandatory — the video must be "watched" via its transcript:
     ```bash
     yt-dlp --write-auto-sub --sub-format json3 --skip-download --output "{vault}/raw/videos/{id}.%(ext)s" {url}
     ```
     Then `read` the resulting `.json3` transcript file and process it through the full ingest pipeline (discuss, create source summary, extract entities/concepts, etc.).
     - If `--write-auto-sub` fails, try `--write-sub` (manual captions).
     - If no captions of any kind exist, report to the user: "No captions available for this video."
     - Do NOT skip ingest because the video was "already clipped" or because metadata exists. The transcript is the source of truth.
   - **PDF:** Extract text.
2. **Discuss key takeaways** with the user briefly — what's notable, surprising, or contradictory.
3. **Create a source summary** in `wiki/sources/<slug.md>` — filename from source title, lowercase-dashes.
4. **Extract and update entities** — create or update pages in `wiki/entities/<name.md>` for people, organizations, tools mentioned.
5. **Extract and update concepts** — create or update pages in `wiki/concepts/<name.md>` for topics, ideas, techniques.
6. **Update synthesis pages** in `wiki/synthesis/` if the source shifts high-level understanding.
7. **Update index.md** — add new pages, refresh summaries if needed. Maintain categories: Concepts, Entities, Sources, Synthesis, Analysis.
8. **Append to log.md** using the format: `## [YYYY-MM-DD] ingest | Source Title` followed by bullet points of what was created/updated.
9. **Report to the user** — number of pages created/updated, key insights, any contradictions found.

A single source might touch 10-15 wiki pages. Stay involved with the user during ingest — discuss emphasis and what to prioritize.

#### Tracking Ingested Sources

Before ingesting, check whether `wiki/sources/<slug>.md` already exists. If it does, prompt the user: "Already ingested. Re-ingest to refresh (overwrites page)? Skip?"

### Query the Wiki

**Trigger:** `/skill:obsidian-wiki query "<question>"` or just ask a question when the skill is active.

1. **Search relevant wiki pages** — start by reading `wiki/index.md` to find relevant pages, then `read` into specific pages.
2. **Synthesize an answer** with citations using `[[wiki links]]`. Answer the specific question asked.
3. **Offer to file it back** — if the answer is valuable (comparison, analysis, discovery), ask whether to save it as `wiki/analysis/<slug.md>`. Include it in the index and log entry.

### Lint the Wiki

**Trigger:** `/skill:obsidian-wiki lint`

Perform these checks:

| Check | What to look for |
|-------|-----------------|
| **Contradictions** | Claims on different pages that conflict with each other. Mark with `> ⚠️ Contradicts [[page]]: ...` |
| **Stale claims** | Older pages superseded by newer sources. Update or note the newer information. |
| **Orphan pages** | Pages with no inbound `[[links]]` from other wiki pages. Flag and suggest linking. |
| **Missing cross-refs** | Pages that mention concepts/entities without linking to them. |
| **Concepts without pages** | Important concepts mentioned on other pages but lacking their own dedicated page. |
| **Data gaps** | Areas that could be filled with a quick web search. |
| **Log/Index drift** | Entries in log.md not reflected in index.md or vice versa. |
| **Inbox orphans** | Files sitting in `raw/inbox/` for more than a few days. Suggest ingesting or clearing them. |

Report findings as a checklist. For each issue, suggest a fix. Ask the user which to apply, then apply them.

### Wiki Status

**Trigger:** `/skill:obsidian-wiki status`

Report:
- Total page count by category (concepts, entities, sources, synthesis, analysis)
- Most recent ingest date from `log.md`
- Last 5 log entries
- Inbox contents (if any)
- Any obvious issues (recent lint not run, growing number of orphans, etc.)

## Index Format

Always maintain `wiki/index.md` in this format:

```markdown
# Wiki Index

## Concepts
- [[concept-name]] - One-line summary (source count)

## Entities
- [[entity-name]] - One-line summary

## Sources
- [[source-title]] - One-line summary

## Synthesis
- [[overview-name]] - One-line summary

## Analysis
- [[analysis-title]] - One-line summary
```

## Log Format

Always append to `wiki/log.md` using:

```markdown
## [YYYY-MM-DD] ingest | Article Title
- Created [[source-title]] from raw/articles/title.md
- Updated [[concept-name]], [[entity-name]]
- Key insight: ...
```

Entry types: `ingest`, `query`, `lint`. Use `grep "^## \[" wiki/log.md | tail -5` to see recent entries.

## Page Conventions

- Use `[[wiki links]]` for all cross-references (Obsidian-compatible)
- Keep page filenames concise and `lowercase-with-dashes`
- Each page should have: title (H1), summary line, content, links to related pages
- Mark contradictions explicitly: `> ⚠️ Contradicts [[page]]: description`
- Use tags at the top if useful: e.g., `#status/evergreen`, `#type/concept`

## Tips

- At small-to-moderate scale (~100 sources, hundreds of pages), the index file is enough for navigation — no embedding/RAG needed. Use `rg` over wiki/ for targeted search.
- For large wikis, mention that `qmd` (local markdown search engine with hybrid BM25/vector search) could be added as a CLI tool.
- When ingesting web-clipped articles, note that images should be downloaded locally for pi to reference them.