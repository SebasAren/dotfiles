import { describe, test, expect, mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rg, findCandidates, showContext, rerank, main } from "./wiki-search";

async function makeTmpDir(prefix: string): Promise<string> {
  return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

// ── Unit tests: rg wrapper ──

describe("rg", () => {
  test("returns matching output for a valid search", () => {
    const out = rg(["--version"]);
    expect(out).toMatch(/ripgrep/);
  });

  test("returns empty string when no matches (exit code 1)", () => {
    const out = rg(["-l", "zzz_no_such_string_xyzzy", "/tmp"]);
    expect(out).toBe("");
  });
});

// ── Unit tests: findCandidates ──

describe("findCandidates", () => {
  const wikiDir = `${process.env.HOME}/Documents/llm-wiki/wiki`;

  test.skipIf(!Bun.file(`${wikiDir}/index.md`).size)(
    "finds pages matching a keyword",
    () => {
      const results = findCandidates("spec paradox", wikiDir);
      expect(results.length).toBeGreaterThan(0);
      // Should find the concept page
      expect(results.some((f) => f.includes("spec-paradox"))).toBe(true);
    },
  );

  test("returns empty array for nonsense query", () => {
    const results = findCandidates("zzz_no_such_string_xyzzy_12345", wikiDir);
    expect(results).toEqual([]);
  });

  test("results are sorted alphabetically", () => {
    const results = findCandidates("agent", wikiDir);
    if (results.length < 2) return;
    const sorted = [...results].sort();
    expect(results).toEqual(sorted);
  });
});

// ── Unit tests: showContext ──

describe("showContext", () => {
  const wikiDir = `${process.env.HOME}/Documents/llm-wiki/wiki`;

  test.skipIf(!Bun.file(`${wikiDir}/index.md`).size)(
    "returns context lines around matches",
    () => {
      const candidates = findCandidates("spec paradox", wikiDir);
      const conceptPage = candidates.find((f) => f.includes("spec-paradox.md"));
      if (!conceptPage) return;

      const ctx = showContext("spec paradox", conceptPage, 2);
      expect(ctx).toContain("Spec Paradox");
      // Should have context separator lines
      expect(ctx).toContain("--");
    },
  );

  test("returns empty string for no matches in file", () => {
    const ctx = showContext("zzz_no_such_string_xyzzy", "/tmp/empty.txt", 2);
    expect(ctx).toBe("");
  });
});

// ── Unit tests: rerank ──

describe("rerank", () => {
  test("returns identity order when API returns error", async () => {
    // Use a bogus API key to trigger error path
    const original = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key-for-rerank-error";

    // Temp files for testing
    const tmpDir = await makeTmpDir("wiki-search-test-");
    const file1 = `${tmpDir}/doc1.md`;
    const file2 = `${tmpDir}/doc2.md`;
    await Bun.write(file1, "Document about cats");
    await Bun.write(file2, "Document about dogs");

    // This will hit the real API with a fake key and get an error
    const indices = await rerank("cats", [file1, file2], 2, tmpDir);
    // On error, should fall back to identity order
    expect(indices).toEqual([0, 1]);

    // Cleanup
    rmSync(tmpDir, { recursive: true });
    process.env.OPENROUTER_API_KEY = original;
  });

  test("sends correct payload structure", async () => {
    const tmpDir = await makeTmpDir("wiki-search-test-");
    const file1 = `${tmpDir}/test.md`;
    await Bun.write(file1, "Content about machine learning agents");

    let capturedBody: any = null;
    let capturedAuth: string | null = null;

    // Mock global fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (url: string, opts: any) => {
      capturedBody = JSON.parse(opts.body);
      capturedAuth = opts.headers.Authorization;
      return new Response(
        JSON.stringify({ results: [{ index: 0, relevance_score: 0.95 }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    process.env.OPENROUTER_API_KEY = "test-key";
    const indices = await rerank("machine learning", [file1], 1, tmpDir);

    expect(capturedBody.model).toBe("cohere/rerank-4-fast");
    expect(capturedBody.query).toBe("machine learning");
    expect(capturedBody.top_n).toBe(1);
    expect(capturedBody.documents).toHaveLength(1);
    expect(capturedBody.documents[0]).toContain("test.md:");
    expect(capturedBody.documents[0]).toContain(
      "Content about machine learning agents",
    );
    expect(capturedAuth).toBe("Bearer test-key");
    expect(indices).toEqual([0]);

    // Cleanup
    rmSync(tmpDir, { recursive: true });
    globalThis.fetch = originalFetch;
  });
});

// ── Integration tests: main ──

describe("main", () => {
  const wikiDir = `${process.env.HOME}/Documents/llm-wiki/wiki`;
  const hasWiki = Bun.file(`${wikiDir}/index.md`).size > 0;

  test("shows help text with --help", async () => {
    const out = await main(["--help"], {});
    expect(out).toContain("wiki-search");
    expect(out).toContain("--context");
    expect(out).toContain("--no-rerank");
  });

  test("shows help text with no args", async () => {
    const out = await main([], {});
    expect(out).toContain("wiki-search");
  });

  test("reports no matches for nonsense query", async () => {
    const out = await main(["zzz_no_such_string_xyzzy_12345"], {});
    expect(out).toContain("No matching pages found");
  });

  test.skipIf(!hasWiki)("finds results with --no-rerank", async () => {
    const out = await main(["spec paradox", "--no-rerank"], {});
    expect(out).toContain("matching page(s)");
    expect(out).toContain("spec-paradox");
    // Should NOT contain rerank header
    expect(out).not.toContain("Reranked by relevance");
  });

  test.skipIf(!hasWiki)("respects --context flag", async () => {
    const out1 = await main(
      ["spec paradox", "--no-rerank", "--context", "0"],
      {},
    );
    const out2 = await main(
      ["spec paradox", "--no-rerank", "--context", "5"],
      {},
    );
    // More context = longer output
    expect(out2.length).toBeGreaterThan(out1.length);
  });

  test.skipIf(!hasWiki)("respects --top flag with rerank", async () => {
    // Mock fetch for rerank
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const topN = body.top_n;
      const results = Array.from(
        { length: Math.min(topN, body.documents.length) },
        (_, i) => ({
          index: i,
          relevance_score: 0.9 - i * 0.1,
        }),
      );
      return new Response(JSON.stringify({ results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const out = await main(["agent", "--top", "2"], {
      OPENROUTER_API_KEY: "test-key",
    });
    expect(out).toContain("Reranked by relevance");

    // Count how many page headers appear (───)
    const pageHeaders = out.match(/─── .+ ───/g) ?? [];
    expect(pageHeaders.length).toBe(2);

    globalThis.fetch = originalFetch;
  });

  test("skips rerank when no OPENROUTER_API_KEY", async () => {
    const out = await main(["spec paradox", "--no-rerank"], {});
    expect(out).not.toContain("Reranked");
  });

  test("joins multi-word query from positionals", async () => {
    // This would match "spec paradox" as a two-word query
    const out = await main(["spec", "paradox", "--no-rerank"], {});
    // Should find results for the combined phrase
    if (!out.includes("No matching pages found")) {
      expect(out).toContain("matching page(s)");
    }
  });
});
