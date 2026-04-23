import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock, piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies before importing the module
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("@sinclair/typebox", typeboxMock);

import { extractSearchTerms, STOP_WORDS } from "./pre-search";

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

describe("STOP_WORDS", () => {
  it("is exported as a Set", () => {
    expect(STOP_WORDS).toBeInstanceOf(Set);
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("explore")).toBe(true);
  });
});
