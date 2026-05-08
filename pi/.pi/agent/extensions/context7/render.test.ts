import { describe, it, expect, mock } from "bun:test";

// Mock TUI
mock.module("@mariozechner/pi-tui", () => ({
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

  it("shows error no details with text content", () => {
    const result = renderSearchResult(
      { content: [{ type: "text", text: "Network error" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Network error");
  });

  it("shows generic error no details without text content", () => {
    const result = renderSearchResult(
      { content: [{ type: "image", text: "img.png" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Context7 search failed");
  });

  it("shows expanded view with relevant lines", () => {
    const result = renderSearchResult(
      {
        content: [
          {
            type: "text",
            text: "### React\n- **ID**: /facebook/react\n### Vue\n- **ID**: /vuejs/vue\n",
          },
        ],
        details: { query: "hooks", libraryName: "react", resultCount: 2 },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("React");
    expect(result.text).toContain("/facebook/react");
    expect(result.text).toContain("Vue");
    expect(result.text).toContain("/vuejs/vue");
  });

  it("shows truncation when more than 20 relevant lines", () => {
    const manyLines = Array.from(
      { length: 25 },
      (_, i) => `### Library ${i + 1}\n- **ID**: /lib/${i + 1}`,
    ).join("\n");
    const result = renderSearchResult(
      {
        content: [{ type: "text", text: manyLines }],
        details: { query: "hooks", libraryName: "react", resultCount: 25 },
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
        details: { query: "hooks", libraryName: "react", resultCount: 1 },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toBeDefined();
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

  it("reuses context.lastComponent", () => {
    const { Text } = require("@mariozechner/pi-tui");
    const existing = new Text("old", 0, 0);
    const result = renderDocsCall({ libraryId: "/facebook/react", query: "hooks" }, makeTheme(), {
      lastComponent: existing,
    });
    expect(result).toBe(existing);
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

  it("shows error no details with text content", () => {
    const result = renderDocsResult(
      { content: [{ type: "text", text: "API error" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("API error");
  });

  it("shows generic error no details without text content", () => {
    const result = renderDocsResult(
      { content: [{ type: "image", text: "img.png" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Context7 docs failed");
  });

  it("shows expanded view with relevant lines", () => {
    const result = renderDocsResult(
      {
        content: [
          {
            type: "text",
            text: "### React hooks\n```tsx\nconst [count, setCount] = useState(0);\n```\n### Vue hooks\n```ts\nconst count = ref(0);\n```\n",
          },
        ],
        details: { libraryId: "/facebook/react", query: "hooks", snippetCount: 2 },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("React hooks");
    expect(result.text).toContain("Vue hooks");
    expect(result.text).toContain("```tsx");
    expect(result.text).toContain("```ts");
  });

  it("shows truncation when more than 15 relevant lines", () => {
    const manyLines = Array.from(
      { length: 18 },
      (_, i) => `### Snippet ${i + 1}\n\`\`\`\ncode\n\`\`\``,
    ).join("\n");
    const result = renderDocsResult(
      {
        content: [{ type: "text", text: manyLines }],
        details: { libraryId: "/facebook/react", query: "hooks", snippetCount: 18 },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("(more snippets)");
  });

  it("expanded view with non-text content does not crash", () => {
    const result = renderDocsResult(
      {
        content: [{ type: "image", text: "img.png" }],
        details: { libraryId: "/facebook/react", query: "hooks", snippetCount: 1 },
      },
      { expanded: true, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("1 snippets");
  });
});
