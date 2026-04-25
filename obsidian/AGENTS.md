# Obsidian

Stowed scripts for the personal wiki at `~/Documents/wiki/`, based on [Andrej Karpathy's LLM wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f).

## What's Here

| Path | Description |
|------|-------------|
| `.local/bin/wiki-search` | Hybrid BM25 + vector search CLI with Cohere reranking |
| `.local/lib/wiki-search/` | Search engine implementation (BM25, embeddings, cache) |

## Search Engine (`wiki-search`)

Three search modes:

1. **Hybrid** (default) — BM25 keyword scoring + 4096-dim vector embeddings with configurable alpha blend
2. **BM25-only** — Cached keyword search, no API key needed
3. **Semantic** — Vector-only search for conceptual queries

All modes use cached indexes rebuilt incrementally when the wiki changes. Reranking via `cohere/rerank-4-fast` through OpenRouter.

### Library

| File | Purpose |
|------|---------|
| `cli.ts` | Argument parsing, cache management, mode routing |
| `search.ts` | `hybridSearch()`, ripgrep helpers, `rerank()` |
| `bm25.ts` | BM25 ranking implementation |
| `vector.ts` | Cosine similarity, embedding API client |
| `cache.ts` | Incremental index builds, staleness detection, manifest |
| `text.ts` | Markdown stripping, tokenization |
| `constants.ts` | Model names, API URLs, tuning parameters |

## Stow

```bash
stow obsidian    # install
stow -D obsidian # uninstall
```
