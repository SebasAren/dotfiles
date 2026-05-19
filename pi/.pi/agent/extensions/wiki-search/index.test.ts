/**
 * Wiki Search Extension — unit tests.
 */

import { describe, it, expect, mock, beforeAll } from "bun:test";

beforeAll(() => {
  mock.module("@earendil-works/pi-coding-agent", () => ({
    DEFAULT_MAX_BYTES: 100_000,
    DEFAULT_MAX_LINES: 500,
    truncateHead: (text: string) => ({ content: text, truncated: false }),
  }));
  mock.module("@earendil-works/pi-tui", () => ({
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

import type { Theme } from "@earendil-works/pi-coding-agent";
import { WikiSearchDetails } from "./index";
import { renderSearchCall, renderSearchResult } from "./render";

// ── renderSearchCall ───────────────────────────────────────────────────────

describe("renderSearchCall", () => {
  const theme = {
    fg: (key: string, text: string) => `[${key}:${text}]`,
    bold: (text: string) => `**${text}**`,
  } as unknown as Theme;

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
  } as unknown as Theme;

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

  it("shows error no details with text content", () => {
    const text = renderSearchResult(
      makeResult(undefined, "Something broke"),
      { expanded: false, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("Something broke");
  });

  it("shows generic error no details without text content", () => {
    const text = renderSearchResult(makeResult(), { expanded: false, isPartial: false }, theme);
    expect((text as any).text).toContain("Wiki search failed");
  });

  it("shows semantic flag in results", () => {
    const text = renderSearchResult(
      makeResult({
        query: "test",
        resultCount: 3,
        reranked: true,
        semantic: true,
        ...baseDetails,
      }),
      { expanded: false, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("[semantic]");
  });

  it("shows no rerank flag in results", () => {
    const text = renderSearchResult(
      makeResult({
        query: "test",
        resultCount: 3,
        reranked: false,
        semantic: false,
        ...baseDetails,
      }),
      { expanded: false, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("(no rerank)");
  });

  it("shows truncation when more than 20 relevant lines", () => {
    // Generate 25 lines starting with "───"
    const manyLines = Array.from({ length: 25 }, (_, i) => `─── page${i + 1}.md`).join("\n");
    const text = renderSearchResult(
      makeResult(
        {
          ...baseDetails,
          query: "test",
          resultCount: 25,
          reranked: true,
          semantic: false,
          paths: [],
        },
        manyLines,
      ),
      { expanded: true, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("(more results)");
  });

  it("shows singular result label", () => {
    const text = renderSearchResult(
      makeResult({
        query: "test",
        resultCount: 1,
        reranked: true,
        semantic: false,
        ...baseDetails,
      }),
      { expanded: false, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("1 result");
  });

  it("shows === lines in expanded view with muted style", () => {
    const text = renderSearchResult(
      makeResult(
        {
          ...baseDetails,
          query: "test",
          resultCount: 1,
          reranked: true,
          semantic: false,
          paths: [],
        },
        "=== summary line\n─── result.md",
      ),
      { expanded: true, isPartial: false },
      theme,
    );
    expect((text as any).text).toContain("summary line");
    expect((text as any).text).toContain("result.md");
  });

  it("expanded view with no text content does not crash", () => {
    const text = renderSearchResult(
      {
        content: [{ type: "image", text: "img.png" }],
        details: { query: "test", resultCount: 0, reranked: true, semantic: false, ...baseDetails },
      },
      { expanded: true, isPartial: false },
      theme,
    );
    expect((text as any).text).toBeDefined();
  });
});
