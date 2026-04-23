/**
 * Wiki Search Extension — unit tests.
 */

import { describe, it, expect, mock, beforeAll } from "bun:test";

beforeAll(() => {
  mock.module("@mariozechner/pi-coding-agent", () => ({
    DEFAULT_MAX_BYTES: 100_000,
    DEFAULT_MAX_LINES: 500,
    truncateHead: (text: string) => ({ content: text, truncated: false }),
  }));
  mock.module("@mariozechner/pi-tui", () => ({
    Text: class {
      text = "";
      constructor(text: string, _x: number, _y: number) {
        this.text = text;
      }
      setText(t: string) {
        this.text = t;
      }
    },
  }));
});

import { executeWikiSearch, WikiSearchDetails } from "./index";
import { renderSearchCall, renderSearchResult } from "./render";

// ── executeWikiSearch ──────────────────────────────────────────────────────

describe("executeWikiSearch", () => {
  const BINARY =
    "/var/home/sebas/.local/share/worktrees/dotfiles/obsidian-search/obsidian/.local/bin/wiki-search";

  it("returns structured result for a valid query", async () => {
    const result = await executeWikiSearch({ query: "agent orchestration", top: 3 }, BINARY);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(typeof result.content[0].text).toBe("string");
    expect(result.details).toBeDefined();
    expect(result.details!.query).toBe("agent orchestration");
    expect(result.details!.resultCount).toBeGreaterThanOrEqual(0);
    expect(result.details!.reranked).toBe(true);
    expect(result.details!.semantic).toBe(false);
    expect(result.details!.wikiDir).toBe(`${process.env.HOME}/Documents/wiki/wiki`);
    expect(Array.isArray(result.details!.paths)).toBe(true);
  }, 15_000);

  it("respects semantic and no_rerank flags", async () => {
    const result = await executeWikiSearch(
      {
        query: "agent orchestration",
        top: 2,
        semantic: true,
        no_rerank: true,
      },
      BINARY,
    );

    expect(result.details!.semantic).toBe(true);
    expect(result.details!.reranked).toBe(false);
    expect(Array.isArray(result.details!.paths)).toBe(true);
  }, 15_000);
});

// ── renderSearchCall ───────────────────────────────────────────────────────

describe("renderSearchCall", () => {
  const theme = {
    fg: (key: string, text: string) => `[${key}:${text}]`,
    bold: (text: string) => `**${text}**`,
  };

  it("renders basic query", () => {
    const text = renderSearchCall({ query: "agent swarm" }, theme, {});
    expect((text as any).text).toContain("agent swarm");
    expect((text as any).text).toContain("wiki_search");
  });

  it("shows semantic flag", () => {
    const text = renderSearchCall({ query: "test", semantic: true }, theme, {});
    expect((text as any).text).toContain("[semantic]");
  });

  it("shows no_rerank flag", () => {
    const text = renderSearchCall({ query: "test", no_rerank: true }, theme, {});
    expect((text as any).text).toContain("(no rerank)");
  });
});

// ── renderSearchResult ─────────────────────────────────────────────────────

describe("renderSearchResult", () => {
  const theme = {
    fg: (key: string, text: string) => `[${key}:${text}]`,
    bold: (text: string) => `**${text}**`,
  };

  const makeResult = (
    details?: WikiSearchDetails,
    text?: string,
  ): { content: Array<{ type: string; text?: string }>; details?: WikiSearchDetails } => ({
    content: text ? [{ type: "text", text }] : [],
    details,
  });

  it("shows loading state", () => {
    const text = renderSearchResult(makeResult(), { expanded: false, isPartial: true }, theme);
    expect((text as any).text).toContain("Searching wiki...");
  });

  const baseDetails = {
    wikiDir: "/home/test/Documents/wiki/wiki",
    paths: [] as string[],
  };

  it("shows result count", () => {
    const text = renderSearchResult(
      makeResult({
        query: "test",
        resultCount: 5,
        reranked: true,
        semantic: false,
        ...baseDetails,
      }),
      { expanded: false, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("5 results");
  });

  it("shows zero results", () => {
    const text = renderSearchResult(
      makeResult({ query: "xyz", resultCount: 0, reranked: true, semantic: false, ...baseDetails }),
      { expanded: false, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("0 results");
  });

  it("shows expanded results", () => {
    const text = renderSearchResult(
      makeResult(
        {
          ...baseDetails,
          query: "test",
          resultCount: 2,
          reranked: true,
          semantic: false,
          paths: [
            "/home/test/Documents/wiki/wiki/page1.md",
            "/home/test/Documents/wiki/wiki/page2.md",
          ],
        },
        "─── page1.md\ncontent\n─── page2.md\ncontent",
      ),
      { expanded: true, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("page1.md");
    expect((text as any).text).toContain("page2.md");
  });
});
