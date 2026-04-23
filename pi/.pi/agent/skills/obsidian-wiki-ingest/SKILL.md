---
name: obsidian-wiki-ingest
description: Ingest sources into the personal wiki at ~/Documents/wiki/. Use when the user wants to add articles, videos, papers, notes, or URLs to the wiki. Invoke with /skill:obsidian-wiki-ingest or /skill:obsidian-wiki-ingest <path-or-url>.
---

# Ingest Sources into the Wiki

Process sources into the persistent wiki at `~/Documents/wiki/`.

## Vault Layout

```
~/Documents/wiki/
├── raw/                   # Immutable source documents placed by the user (LLM reads, never writes generated artifacts here)
│   ├── inbox/             # Staging area — drop files/URLs here, agent moves them
│   ├── articles/          # Web articles, blog posts, news
│   ├── notes/             # Markdown notes, text files
│   ├── papers/            # Academic papers, PDFs
│   ├── videos/            # User-placed video files
├── wiki/                  # LLM-maintained knowledge base
│   ├── concepts/          # Concept & topic pages
│   ├── entities/          # Entity pages (people, places, things)
│   ├── sources/           # Source summaries
│   ├── synthesis/         # High-level overviews and synthesis
│   └── analysis/          # Answers, comparisons, explorations filed back
└── SCHEMA.md              # Wiki structure & conventions
```

## Core Principles

1. **Raw sources are user-placed and immutable** — never modify files in `raw/` and never write generated artifacts (transcripts, extracted text, etc.) into it
2. **The wiki is LLM-owned** — create, update, link, and maintain all pages
3. **Cross-reference aggressively** — use `[[wiki links]]` for all references
4. **File valuable outputs back** — save analyses as wiki pages, not in chat history
5. **Discovery is search-based** — `wiki_search` replaces manual index maintenance

## Inbox Ingest Flow

**Trigger:** `/skill:obsidian-wiki-ingest` (no path) — process `raw/inbox/`.
**Or:** `/skill:obsidian-wiki-ingest <path-or-url>` for explicit sources.

1. **Detect inbox contents** — check `raw/inbox/` for files and URLs.
2. **Classify and move** each item:
   - `.pdf` → `raw/papers/`
   - `.md`, `.txt`, `.org` → `raw/notes/`
   - `.html`, `.htm` → `raw/articles/`
   - URLs, web content → `raw/articles/`
   - YouTube URLs → `raw/videos/`
   - `.mp4`, `.mkv`, `.webm` → `raw/videos/`
   - Fallback: `raw/notes/`
3. **Ingest each source** (steps below).
4. **Empty inbox** when done.

## Source Skepticism — Critical Evaluation During Ingest

Not all sources deserve equal trust. Apply critical thinking based on source type:

### Source Credibility Tiers

| Tier | Examples | Default Stance |
|------|----------|---------------|
| **High** | Peer-reviewed papers, official docs, established publications | Trust claims unless contradicted by other sources |
| **Medium** | Blog posts from known authors, conference talks, technical books | Verify surprising claims; note author credentials |
| **Low** | Reddit/HN/forum posts, social media, random blogs, anonymous sources | **Demand evidence** — flag unsupported claims explicitly |

### Rules for Low-Credibility Sources

1. **Flag unbacked strong claims.** If a Reddit post says "X is definitely the cause of Y" without citing evidence, record the claim but mark it:
   ```markdown
   > ⚠️ **Unverified claim** from low-credibility source: "X causes Y" — no evidence provided. See [[related-concept]] for established understanding.
   ```
2. **Ask the user before promoting speculation to wiki pages.** If a source makes a surprising or controversial claim, call it out during the discussion step: _"This post claims X without evidence. Should I record this as an unverified claim, or skip it?"_
3. **Separate observation from interpretation.** A forum post describing a personal experience is a valid data point. The poster's theory about _why_ it happened is not.
4. **Check for confounding factors.** Forum advice often omits context (environment, versions, prerequisites). Note these gaps.
5. **Bias awareness.** Reddit/HN threads have selection bias (only people with strong opinions post). A thread full of agreement doesn't make something true.

### When In Doubt

- **Record the claim with a qualifier** ("claimed", "reported", "alleged") rather than as fact
- **Link to higher-tier sources** that address the same topic, if they exist in the wiki
- **Never silently drop claims** — the user chose to ingest this source for a reason, so surface the controversy

## Ingest Steps

1. **Read the source:**
   - **Local file:** `read` it directly.
   - **URL (web):** `web_fetch` it.
   - **URL (YouTube):** Fetch transcript with `yt-dlp` to a temp directory, process it, then clean up:
     ```bash
     TMPDIR=$(mktemp -d)
     yt-dlp --write-auto-sub --sub-format vtt --convert-subs srt --skip-download \
       --output "$TMPDIR/{id}.%(ext)s" {url}
     # Strip timestamps and formatting
     sed '/^[0-9]/d; /^$/d; /-->/d' "$TMPDIR/{id}.en.srt" \
       | sed 's/<[^>]*>//g' | uniq > "$TMPDIR/{slug}.md"
     rm "$TMPDIR/{id}.en.srt"
     ```
     Then `read` the resulting `$TMPDIR/{slug}.md`. If `--write-auto-sub` fails, try `--write-sub`. If no captions exist, tell the user.
     
     When ingestion is complete, remove the temp directory:
     ```bash
     rm -rf "$TMPDIR"
     ```
   - **PDF:** Extract text.
2. **Evaluate claim strength** — identify the source's credibility tier (see Source Skepticism above). Flag unsupported strong claims and controversial assertions.
3. **Discuss key takeaways** with the user — surface any flagged claims for their review before writing to the wiki.
4. **Create source summary** in `wiki/sources/<slug>.md`.
5. **Extract and update entities** in `wiki/entities/<name>.md`.
6. **Extract and update concepts** in `wiki/concepts/<name>.md`.
7. **Update synthesis pages** if the source shifts high-level understanding.
8. **Report** — pages created/updated, key insights, contradictions. Include any credibility warnings for low-tier sources.

A single source may touch 10-15 pages. Stay involved with the user during ingest.

## Duplicate Check

Before ingesting, search for existing coverage of the source's topics using the `wiki_search` tool:

```
wiki_search:0 {"query": "<topic/keywords>", "top": 5}

```

The tool returns match-context snippets in `content[0].text` and full paths in `details.paths`. Snippets may be sparse for semantic hits. Read the files at `details.paths` to verify whether this source was already ingested. If a matching source already exists: "Already ingested. Re-ingest to refresh (overwrites)? Skip?"

For direct file lookup by slug, check if `wiki/sources/<slug>.md` exists.

## Page Conventions

- `[[wiki links]]` for all cross-references
- Filenames: `lowercase-with-dashes`
- Each page: title (H1), summary line, content, related links section
- Mark contradictions: `> ⚠️ Contradicts [[page]]: description`
- Mark unverified claims: `> ⚠️ **Unverified claim** from [source-type]: description — no evidence provided.`
