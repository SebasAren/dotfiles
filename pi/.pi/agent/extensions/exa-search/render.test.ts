import { describe, it, expect, mock } from "bun:test";

// Mock TUI
mock.module("@earendil-works/pi-tui", () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
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
    const { Text } = require("@earendil-works/pi-tui");
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

  it("shows error no details with text content", () => {
    const result = renderSearchResult(
      { content: [{ type: "text", text: "API error" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("API error");
  });

  it("shows generic error no details without text content", () => {
    const result = renderSearchResult(
      { content: [{ type: "image", text: "img.png" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Search failed");
  });

  it("shows expanded view with relevant lines", () => {
    const result = renderSearchResult(
      {
        content: [
          {
            type: "text",
            text: "### Result 1\nURL: https://example.com\nPublished: 2024-01-01\n### Result 2\nURL: https://other.com\n",
          },
        ],
        details: { query: "test", resultCount: 2, truncated: false },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Result 1");
    expect(result.text).toContain("https://example.com");
    expect(result.text).toContain("Published: 2024-01-01");
    expect(result.text).toContain("Result 2");
  });

  it("shows truncation when more than 30 relevant lines", () => {
    const manyLines = Array.from(
      { length: 35 },
      (_, i) => `### Result ${i + 1}\nURL: https://example.com/${i + 1}`,
    ).join("\n");
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: manyLines }],
        details: { query: "test", resultCount: 35, truncated: false },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("(more results)");
  });

  it("expanded view with non-text content does not crash", () => {
    const result = renderSearchResult(
      {
        content: [{ type: "image", text: "img.png" }],
        details: { query: "test", resultCount: 1, truncated: false },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("1 results");
  });
});

describe("renderFetchResult", () => {
  it("shows error no details with text content", () => {
    const result = renderFetchResult(
      { content: [{ type: "text", text: "Timeout" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Timeout");
  });

  it("shows generic error no details without text content", () => {
    const result = renderFetchResult(
      { content: [{ type: "image", text: "img.png" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Fetch failed");
  });

  it("shows truncated indicator", () => {
    const result = renderFetchResult(
      {
        content: [{ type: "text", text: "Content" }],
        details: {
          urls: ["url1"],
          format: "text",
          successCount: 1,
          errorCount: 0,
          truncated: true,
        },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("truncated");
  });

  it("shows expanded view with relevant lines", () => {
    const result = renderFetchResult(
      {
        content: [
          {
            type: "text",
            text: "## Page 1\nURL: https://example.com/page1\n## Page 2\nURL: https://example.com/page2\n",
          },
        ],
        details: {
          urls: ["url1", "url2"],
          format: "text",
          successCount: 2,
          errorCount: 0,
          truncated: false,
        },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Page 1");
    expect(result.text).toContain("https://example.com/page1");
    expect(result.text).toContain("Page 2");
  });

  it("expanded view with non-text content does not crash", () => {
    const result = renderFetchResult(
      {
        content: [{ type: "image", text: "img.png" }],
        details: {
          urls: ["url1"],
          format: "text",
          successCount: 1,
          errorCount: 0,
          truncated: false,
        },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("1/1 fetched");
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

  it("reuses context.lastComponent", () => {
    const { Text } = require("@earendil-works/pi-tui");
    const existing = new Text("old", 0, 0);
    const result = renderFetchCall({ urls: ["url1"] }, makeTheme(), { lastComponent: existing });
    expect(result).toBe(existing);
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
