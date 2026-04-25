/**
 * Wiki Search Extension — integration tests.
 *
 * These tests call the real `wiki-search` binary and require a local wiki index.
 * They are excluded from `mise run test` — run manually with:
 *   bun test wiki-search/integration.test.ts
 */

import { describe, it, expect, mock, beforeAll } from "bun:test";
import { spawnSync } from "node:child_process";

beforeAll(() => {
  mock.module("@mariozechner/pi-coding-agent", () => ({
    DEFAULT_MAX_BYTES: 100_000,
    DEFAULT_MAX_LINES: 500,
    truncateHead: (text: string) => ({ content: text, truncated: false }),
  }));
  mock.module("@mariozechner/pi-tui", () => ({
    Text: class {
      text = "";
      constructor(text: string) {
        this.text = text;
      }
    },
  }));
});

import { executeWikiSearch } from "./index";

const BINARY = "wiki-search";

const binaryAvailable = spawnSync("which", [BINARY], { encoding: "utf8" }).status === 0;

const maybeIt = binaryAvailable ? it : it.skip;

describe("executeWikiSearch (integration)", () => {
  maybeIt(
    "returns structured result for a valid query",
    async () => {
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
    },
    15_000,
  );

  maybeIt(
    "respects semantic and no_rerank flags",
    async () => {
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
    },
    15_000,
  );
});
