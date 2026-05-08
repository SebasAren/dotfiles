import { describe, it, expect, mock } from "bun:test";
import type { WikiLintDetails } from "./index";

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

import { renderLintCall, renderLintResult } from "./render";

function makeTheme() {
  return {
    fg: (_color: string, text: string) => `<${_color}>${text}</>`,
    bold: (text: string) => `<b>${text}</b>`,
  };
}

describe("renderLintCall", () => {
  it("renders with specific checks", () => {
    const result = renderLintCall({ checks: ["broken-links", "orphans"] }, makeTheme(), {});
    expect(result.text).toContain("wiki_lint");
    expect(result.text).toContain("broken-links");
    expect(result.text).toContain("orphans");
  });

  it("renders with no checks showing 'all checks'", () => {
    const result = renderLintCall({}, makeTheme(), {});
    expect(result.text).toContain("wiki_lint");
    expect(result.text).toContain("all checks");
  });

  it("reuses context.lastComponent", () => {
    const { Text } = require("@mariozechner/pi-tui");
    const existing = new Text("old", 0, 0);
    const result = renderLintCall({ checks: ["orphans"] }, makeTheme(), {
      lastComponent: existing,
    });
    expect(result).toBe(existing);
    expect(result.text).toContain("orphans");
  });
});

describe("renderLintResult", () => {
  const emptyDetails: WikiLintDetails = {
    wikiDir: "/tmp/wiki",
    checksRun: 1,
    totalIssues: 0,
    results: [],
  };

  it("renders partial state", () => {
    const result = renderLintResult(
      { content: [], details: undefined },
      { expanded: false, isPartial: true },
      makeTheme(),
    );
    expect(result.text).toContain("Linting wiki");
  });

  it("renders no details with text content", () => {
    const result = renderLintResult(
      { content: [{ type: "text", text: "Something went wrong" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Something went wrong");
  });

  it("renders no details without text content", () => {
    const result = renderLintResult(
      { content: [{ type: "image", text: "image.png" }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("Wiki lint failed");
  });

  it("renders with 0 issues (success icon)", () => {
    const result = renderLintResult(
      { content: [], details: { ...emptyDetails, totalIssues: 0, checksRun: 3 } },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("wiki_lint");
    expect(result.text).toContain("0 issues");
    expect(result.text).toContain("3 checks");
    expect(result.text).toContain("success");
  });

  it("renders with ≤5 issues (warning icon)", () => {
    const result = renderLintResult(
      { content: [], details: { ...emptyDetails, totalIssues: 3, checksRun: 2 } },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("wiki_lint");
    expect(result.text).toContain("3 issues");
    expect(result.text).toContain("2 checks");
    expect(result.text).toContain("warning");
  });

  it("renders with >5 issues (error icon)", () => {
    const result = renderLintResult(
      { content: [], details: { ...emptyDetails, totalIssues: 10, checksRun: 1 } },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("10 issues");
    expect(result.text).toContain("1 check");
    expect(result.text).toContain("error");
  });

  it("renders singular issue and check labels", () => {
    const result = renderLintResult(
      { content: [], details: { ...emptyDetails, totalIssues: 1, checksRun: 1 } },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text).toContain("1 issue");
    expect(result.text).toContain("1 check");
  });

  it("renders expanded with issues from multiple checks", () => {
    const details: WikiLintDetails = {
      wikiDir: "/tmp/wiki",
      checksRun: 2,
      totalIssues: 3,
      results: [
        {
          check: "broken-links",
          issues: [
            { path: "does-not-exist.md", message: "Broken link: [[does-not-exist]]" },
            { path: "also-missing.md", message: "Broken link: [[also-missing]]" },
          ],
        },
        {
          check: "orphans",
          issues: [{ path: "/tmp/wiki/entities/orphan.md", message: "Orphan: no inbound links" }],
        },
      ],
    };

    const result = renderLintResult(
      { content: [], details },
      { expanded: true, isPartial: false },
      makeTheme(),
    );

    expect(result.text).toContain("broken-links: 2");
    expect(result.text).toContain("orphans: 1");
    expect(result.text).toContain("does-not-exist");
    expect(result.text).toContain("also-missing");
    expect(result.text).toContain("no inbound links");
  });

  it("renders expanded with no issues in a check", () => {
    const details: WikiLintDetails = {
      wikiDir: "/tmp/wiki",
      checksRun: 1,
      totalIssues: 0,
      results: [
        {
          check: "missing-h1",
          issues: [],
        },
      ],
    };

    const result = renderLintResult(
      { content: [], details },
      { expanded: true, isPartial: false },
      makeTheme(),
    );

    expect(result.text).toContain("missing-h1: 0");
    expect(result.text).toContain("success");
  });

  it("renders expanded with >5 issues showing +N more", () => {
    const manyIssues = Array.from({ length: 7 }, (_, i) => ({
      path: `issue-${i + 1}.md`,
      message: `Issue #${i + 1}`,
    }));

    const details: WikiLintDetails = {
      wikiDir: "/tmp/wiki",
      checksRun: 1,
      totalIssues: 7,
      results: [
        {
          check: "broken-links",
          issues: manyIssues,
        },
      ],
    };

    const result = renderLintResult(
      { content: [], details },
      { expanded: true, isPartial: false },
      makeTheme(),
    );

    // Shows first 5 issues
    for (let i = 0; i < 5; i++) {
      expect(result.text).toContain(`Issue #${i + 1}`);
    }
    // Shows +N more indicator
    expect(result.text).toContain("+2 more");
    // Does NOT show the 6th issue
    expect(result.text).not.toContain("Issue #6");
  });

  it("renders not expanded without per-check details", () => {
    const details: WikiLintDetails = {
      wikiDir: "/tmp/wiki",
      checksRun: 2,
      totalIssues: 5,
      results: [
        {
          check: "broken-links",
          issues: [{ path: "missing.md", message: "Broken link" }],
        },
      ],
    };

    const result = renderLintResult(
      { content: [], details },
      { expanded: false, isPartial: false },
      makeTheme(),
    );

    // Shows summary
    expect(result.text).toContain("5 issues");
    expect(result.text).toContain("2 checks");
    // Does NOT show per-check details
    expect(result.text).not.toContain("broken-links: 1");
    expect(result.text).not.toContain("missing.md");
  });

  it("truncates long error text to 100 chars", () => {
    const longText = "x".repeat(200);
    const result = renderLintResult(
      { content: [{ type: "text", text: longText }], details: undefined },
      { expanded: false, isPartial: false },
      makeTheme(),
    );
    expect(result.text.length).toBeLessThanOrEqual(200);
    // Should be at most 100 chars (plus error tags)
  });
});
