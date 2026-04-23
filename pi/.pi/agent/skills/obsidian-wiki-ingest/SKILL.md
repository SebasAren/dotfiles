---
name: obsidian-wiki-ingest
description: Ingest sources into the local LLM wiki at ~/Documents/llm-wiki/. Use when the user wants to add articles, videos, papers, notes, or URLs to the wiki. Invoke with /skill:obsidian-wiki-ingest or /skill:obsidian-wiki-ingest <path-or-url>.
---

# Ingest Sources into the LLM Wiki

Process sources into the persistent wiki at `~/Documents/llm-wiki/`.

## Vault Layout

```
~/Documents/llm-wiki/
├── raw/                   # Immutable source documents (read only)
│   ├── inbox/             # Staging area — drop files/URLs here, agent moves them
│   ├── articles/          # Web articles, blog posts, news
│   ├── notes/             # Markdown notes, text files
│   ├── papers/            # Academic papers, PDFs
│   ├── videos/            # YouTube videos (transcripts only, via yt-dlp)
├── wiki/                  # LLM-maintained knowledge base
│   ├── index.md           # Catalog of all wiki pages
│   ├── log.md             # Chronological activity log (append-only)
│   ├── concepts/          # Concept & topic pages
│   ├── entities/          # Entity pages (people, places, things)
│   ├── sources/           # Source summaries
│   ├── synthesis/         # High-level overviews and synthesis
│   └── analysis/          # Answers, comparisons, explorations filed back
└── SCHEMA.md              # Wiki structure & conventions
```

## Core Principles

1. **Raw sources are immutable** — never modify files in `raw/`
2. **The wiki is LLM-owned** — create, update, link, and maintain all pages
3. **Cross-reference aggressively** — use `[[wiki links]]` for all references
4. **File valuable outputs back** — save analyses as wiki pages, not in chat history
5. **Keep index.md and log.md current** — update on every operation

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

## Ingest Steps

1. **Read the source:**
   - **Local file:** `read` it directly.
   - **URL (web):** `web_fetch` it.
   - **URL (YouTube):** Fetch transcript with `yt-dlp`:
     ```bash
     yt-dlp --write-auto-sub --sub-format vtt --convert-subs srt --skip-download \
       --output "$HOME/Documents/llm-wiki/raw/videos/{id}.%(ext)s" {url}
     ```
     Then convert to clean markdown:
     ```bash
     # Strip timestamps and formatting, save as .md
     sed '/^[0-9]/d; /^$/d; /-->/d' "raw/videos/{id}.en.srt" \
       | sed 's/<[^>]*>//g' | uniq > "raw/videos/{slug}.md"
     # Remove the intermediate .srt file
     rm raw/videos/{id}.en.srt
     ```
     Then `read` the resulting `.md`. If `--write-auto-sub` fails, try `--write-sub`. If no captions exist, tell the user.
   - **PDF:** Extract text.
2. **Discuss key takeaways** with the user.
3. **Create source summary** in `wiki/sources/<slug>.md`.
4. **Extract and update entities** in `wiki/entities/<name>.md`.
5. **Extract and update concepts** in `wiki/concepts/<name>.md`.
6. **Update synthesis pages** if the source shifts high-level understanding.
7. **Update index.md and log.md** — do these **together** in one pass, immediately after creating pages. Do NOT defer index updates.
   - **index.md**: Add every new page with a one-line summary under the correct section (`## Concepts`, `## Entities`, etc.).
   - **log.md**: Append:
     ```markdown
     ## [YYYY-MM-DD] ingest | Source Title
     - Created [[source-title]] from raw/category/file.md
     - Created concepts: [[concept-a]], [[concept-b]]
     - Created entities: [[entity-a]], [[entity-b]]
     - Updated [[existing-page]]
     - Key insight: ...
     ```
   - **Verify**: After updating, confirm every new page appears in index.md:
     ```bash
     for slug in <new-pages>; do grep -q "[[$slug]]" wiki/index.md || echo "MISSING: $slug"; done
     ```
8. **Report** — pages created/updated, key insights, contradictions.

A single source may touch 10-15 pages. Stay involved with the user during ingest.

## Duplicate Check

Before ingesting, use `wiki-search "<topic/keywords>"` to search for existing coverage of the source's topics. If a matching source already exists: "Already ingested. Re-ingest to refresh (overwrites)? Skip?"

For direct file lookup by slug, check if `wiki/sources/<slug>.md` exists.

## Page Conventions

- `[[wiki links]]` for all cross-references
- Filenames: `lowercase-with-dashes`
- Each page: title (H1), summary line, content, related links section
- Mark contradictions: `> ⚠️ Contradicts [[page]]: description`
