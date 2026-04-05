import { describe, it, expect, mock } from "bun:test";

// Mock TUI
mock.module("@mariozechner/pi-tui", () => ({
  Text: class Text {
    text: string;
    constructor(text: string, x: number, y: number) {
      this.text = text;
    }
    setText(t: string) {
      this.text = t;
    }
  },
}));

import { renderSearchCall, renderSearchResult, renderFetchCall, renderFetchResult } from "./render";

function makeTheme() {
  return {
    fg: (_color: string, text: string) => `<${_color}>${text}</>`,
    bold: (text: string) => `<b>${text}</b>`,
  };
}

describe("renderSearchCall", () => {
  it("shows query text", () => {
    const result = renderSearchCall({ query: "test query" }, makeTheme(), {});
    expect(result.text).toContain("test query");
  });

  it("shows type when not 'auto'", () => {
    const result = renderSearchCall({ query: "test", type: "neural" }, makeTheme(), {});
    expect(result.text).toContain("neural");
  });

  it("does not show type when 'auto'", () => {
    const result = renderSearchCall({ query: "test", type: "auto" }, makeTheme(), {});
    expect(result.text).not.toContain("[auto]");
  });

  it("shows category when provided", () => {
    const result = renderSearchCall({ query: "test", category: "news" }, makeTheme(), {});
    expect(result.text).toContain("news");
  });

  it("reuses context.lastComponent", () => {
    const { Text } = require("@mariozechner/pi-tui");
    const existing = new Text("old", 0, 0);
    const result = renderSearchCall({ query: "test" }, makeTheme(), { lastComponent: existing });
    expect(result).toBe(existing);
  });
});

describe("renderSearchResult", () => {
  it("shows partial state", () => {
    const result = renderSearchResult(
      { content: [], details: undefined },
      { expanded: false, isPartial: true },
      makeTheme(),
    );
    expect(result.text).toContain("Searching the web");
  });

  it("shows 'no results' for zero results", () => {
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: "No results" }],
        details: { query: "test", resultCount: 0, truncated: false },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("No results");
  });

  it("shows result count", () => {
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: "Results" }],
        details: { query: "test", resultCount: 5, truncated: false },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("5 results");
  });

  it("shows truncated indicator", () => {
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: "Results" }],
        details: { query: "test", resultCount: 10, truncated: true },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("truncated");
  });
});

describe("renderFetchCall", () => {
  it("shows single URL", () => {
    const result = renderFetchCall({ urls: ["https://example.com/page"] }, makeTheme(), {});
    expect(result.text).toContain("https://example.com/page");
  });

  it("shows URL count for multiple URLs", () => {
    const result = renderFetchCall({ urls: ["url1", "url2", "url3"] }, makeTheme(), {});
    expect(result.text).toContain("3 URLs");
  });

  it("truncates long single URL", () => {
    const longUrl = "https://example.com/" + "a".repeat(80);
    const result = renderFetchCall({ urls: [longUrl] }, makeTheme(), {});
    expect(result.text).toContain("...");
  });

  it("shows format when not 'text'", () => {
    const result = renderFetchCall({ urls: ["url1"], format: "highlights" }, makeTheme(), {});
    expect(result.text).toContain("[highlights]");
  });
});

describe("renderFetchResult", () => {
  it("shows partial state", () => {
    const result = renderFetchResult(
      { content: [], details: undefined },
      { expanded: false, isPartial: true },
      makeTheme(),
    );
    expect(result.text).toContain("Fetching pages");
  });

  it("shows success with fetched count", () => {
    const result = renderFetchResult(
      {
        content: [{ type: "text", text: "Content" }],
        details: {
          urls: ["url1", "url2"],
          format: "text",
          successCount: 2,
          errorCount: 0,
          truncated: false,
        },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("2/2 fetched");
  });

  it("shows error count", () => {
    const result = renderFetchResult(
      {
        content: [{ type: "text", text: "Content" }],
        details: {
          urls: ["url1", "url2"],
          format: "text",
          successCount: 1,
          errorCount: 1,
          truncated: false,
        },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("1 failed");
  });

  it("shows error icon when all failed", () => {
    const result = renderFetchResult(
      {
        content: [{ type: "text", text: "Content" }],
        details: {
          urls: ["url1"],
          format: "text",
          successCount: 0,
          errorCount: 1,
          truncated: false,
        },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("✗");
  });
});
