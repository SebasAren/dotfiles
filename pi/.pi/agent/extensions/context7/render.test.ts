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

import { renderSearchCall, renderSearchResult, renderDocsCall, renderDocsResult } from "./render";

function makeTheme() {
  return {
    fg: (_color: string, text: string) => `<${_color}>${text}</>`,
    bold: (text: string) => `<b>${text}</b>`,
  };
}

describe("renderSearchCall", () => {
  it("shows library name and query", () => {
    const result = renderSearchCall({ libraryName: "react", query: "hooks" }, makeTheme(), {});
    expect(result.text).toContain("react");
    expect(result.text).toContain("hooks");
  });

  it("reuses context.lastComponent", () => {
    const { Text } = require("@mariozechner/pi-tui");
    const existing = new Text("old", 0, 0);
    const result = renderSearchCall({ libraryName: "react", query: "hooks" }, makeTheme(), {
      lastComponent: existing,
    });
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
    expect(result.text).toContain("Searching Context7");
  });

  it("shows 'no libraries' for zero results", () => {
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: "No results" }],
        details: { query: "hooks", libraryName: "react", resultCount: 0 },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("No libraries found");
  });

  it("shows result count", () => {
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: "Results" }],
        details: { query: "hooks", libraryName: "react", resultCount: 5 },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("5 libraries");
  });
});

describe("renderDocsCall", () => {
  it("shows library ID and query", () => {
    const result = renderDocsCall(
      { libraryId: "/facebook/react", query: "hooks" },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("/facebook/react");
    expect(result.text).toContain("hooks");
  });
});

describe("renderDocsResult", () => {
  it("shows partial state", () => {
    const result = renderDocsResult(
      { content: [], details: undefined },
      { expanded: false, isPartial: true },
      makeTheme(),
    );
    expect(result.text).toContain("Fetching documentation");
  });

  it("shows snippet count", () => {
    const result = renderDocsResult(
      {
        content: [{ type: "text", text: "Docs" }],
        details: { libraryId: "/facebook/react", query: "hooks", snippetCount: 3 },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("3 snippets");
  });

  it("shows 'no docs' for zero snippets", () => {
    const result = renderDocsResult(
      {
        content: [{ type: "text", text: "No docs" }],
        details: { libraryId: "/facebook/react", query: "hooks", snippetCount: 0 },
      },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("No docs");
  });
});
