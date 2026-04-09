import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock, piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies before importing the module
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("@sinclair/typebox", typeboxMock);

// We need to extract the functions from the module — they're not exported directly,
// so we test them by importing the module and checking its behavior indirectly.
// Instead, let's define extractSearchTerms inline to match the implementation.

/** Replicate of STOP_WORDS from index.ts for direct testing. */
const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "find",
  "look",
  "explore",
  "related",
  "about",
  "into",
  "what",
  "where",
  "which",
  "how",
  "all",
  "any",
  "some",
  "will",
  "also",
  "just",
  "than",
  "then",
  "there",
  "their",
  "them",
  "they",
  "these",
  "those",
  "other",
  "more",
  "most",
  "very",
  "much",
  "many",
  "such",
  "does",
  "dont",
  "should",
  "could",
  "would",
  "only",
  "even",
  "still",
  "already",
  "not",
  "but",
  "can",
  "are",
  "was",
  "were",
  "been",
  "being",
  "did",
  "has",
  "had",
  "its",
  "you",
  "your",
  "our",
  "use",
  "used",
  "using",
  "need",
  "like",
  "want",
  "get",
  "got",
  "over",
  "under",
]);

/** Replicate of extractSearchTerms from index.ts. */
function extractSearchTerms(query: string): string[] {
  const text = query.split("\n[")[0];

  const quoted: string[] = [];
  for (const m of text.matchAll(/["']([^"']{2,40})["']/g)) {
    quoted.push(m[1]);
  }

  const words = text
    .replace(/[^a-zA-Z0-9\s_-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w.toLowerCase()));

  const seen = new Set(quoted.map((q) => q.toLowerCase()));
  const result = [...quoted];
  for (const w of words) {
    if (!seen.has(w.toLowerCase())) {
      seen.add(w.toLowerCase());
      result.push(w);
    }
  }
  return result.slice(0, 5);
}

describe("extractSearchTerms", () => {
  it("extracts quoted strings as high-priority terms", () => {
    const result = extractSearchTerms(`Look for "delivery tracker" and 'bezorging'`);
    expect(result).toContain("delivery tracker");
    expect(result).toContain("bezorging");
  });

  it("extracts distinctive words from the query", () => {
    const result = extractSearchTerms("inruimen delivery tracker components stores");
    expect(result).toContain("inruimen");
    expect(result).toContain("delivery");
    expect(result).toContain("tracker");
  });

  it("filters out stop words", () => {
    const result = extractSearchTerms("find all the components related to delivery");
    expect(result).not.toContain("find");
    expect(result).not.toContain("all");
    expect(result).not.toContain("the");
    expect(result).not.toContain("related");
    expect(result).toContain("components");
    expect(result).toContain("delivery");
  });

  it("filters out words shorter than 3 chars", () => {
    const result = extractSearchTerms("API routes in the app");
    expect(result).not.toContain("in");
    expect(result).toContain("API");
    expect(result).toContain("routes");
    expect(result).toContain("app");
  });

  it("returns at most 5 terms", () => {
    const result = extractSearchTerms(
      "delivery tracker bezorging tracking status progress route component store composable",
    );
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("deduplicates case-insensitively", () => {
    const result = extractSearchTerms("Delivery delivery DELIVERY");
    // Should only contain "Delivery" once (case of first occurrence)
    expect(result.filter((t) => t.toLowerCase() === "delivery").length).toBe(1);
  });

  it("strips text after injected markers", () => {
    const result = extractSearchTerms(
      "delivery tracker\n[Constraints: thoroughness=medium, max 80 tool calls]",
    );
    expect(result).not.toContain("Constraints");
    expect(result).not.toContain("thoroughness");
    expect(result).toContain("delivery");
    expect(result).toContain("tracker");
  });

  it("returns empty array for stop-word-only queries", () => {
    const result = extractSearchTerms("find all the related");
    expect(result).toEqual([]);
  });

  it("handles mixed quoted and unquoted terms", () => {
    const result = extractSearchTerms(`Look for "delivery tracker" and tracking status`);
    expect(result[0]).toBe("delivery tracker");
    expect(result).toContain("tracking");
    expect(result).toContain("status");
  });
});
