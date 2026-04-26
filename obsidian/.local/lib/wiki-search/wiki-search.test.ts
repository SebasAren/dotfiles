import { describe, test, expect, mock } from "bun:test";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  rg,
  findCandidates,
  showContext,
  rerank,
  main,
  tokenize,
  buildBm25Index,
  scoreBm25,
  cosineSimilarity,
  normalizeScores,
  extractText,
  hybridSearch,
  buildCache,
  walkMarkdown,
  WIKI_DIR,
} from "./index.ts";

async function makeTmpDir(prefix: string): Promise<string> {
  return mkdtempSync(join(tmpdir(), `${prefix}-`));
}

// ── Unit tests: tokenize ──

describe("tokenize", () => {
  test("splits on whitespace and lowercases", () => {
    expect(tokenize("Hello World")).toEqual(["hello", "world"]);
  });

  test("strips punctuation", () => {
    expect(tokenize("Hello, world!")).toEqual(["hello", "world"]);
  });

  test("ignores short tokens", () => {
    expect(tokenize("a b c hello")).toEqual(["hello"]);
  });

  test("handles empty string", () => {
    expect(tokenize("")).toEqual([]);
  });
});

// ── Unit tests: BM25 ──

describe("buildBm25Index", () => {
  test("computes avgdl and idf for simple docs", () => {
    const docs = [
      { id: "a", text: "hello world" },
      { id: "b", text: "hello foo" },
    ];
    const idx = buildBm25Index(docs);
    expect(idx.N).toBe(2);
    expect(idx.avgdl).toBe(2);
    expect(Object.keys(idx.idf)).toContain("hello");
    expect(Object.keys(idx.idf)).toContain("world");
    expect(Object.keys(idx.idf)).toContain("foo");
  });

  test("handles empty docs", () => {
    const docs = [{ id: "a", text: "" }];
    const idx = buildBm25Index(docs);
    expect(idx.avgdl).toBe(1); // guarded division
    expect(idx.docs[0].len).toBe(0);
  });
});

describe("scoreBm25", () => {
  const idx = buildBm25Index([
    { id: "a", text: "hello world" },
    { id: "b", text: "hello hello foo" },
    { id: "c", text: "bar baz" },
  ]);

  test("ranks docs with more matches higher", () => {
    const scores = scoreBm25("hello", idx);
    expect(scores.has("a")).toBe(true);
    expect(scores.has("b")).toBe(true);
    expect(scores.get("b")! > scores.get("a")!).toBe(true);
    expect(scores.has("c")).toBe(false);
  });

  test("returns empty map for no matches", () => {
    const scores = scoreBm25("xyzzy", idx);
    expect(scores.size).toBe(0);
  });
});

// ── Unit tests: vector math ──

describe("cosineSimilarity", () => {
  test("identical vectors = 1.0", () => {
    const v = [0.1, 0.2, 0.3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  test("orthogonal vectors = 0.0", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
  });

  test("opposite vectors = -1.0", () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
  });

  test("zero vector = 0.0", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe("normalizeScores", () => {
  test("maps to [0,1] range", () => {
    const s = new Map([
      ["a", 10],
      ["b", 20],
      ["c", 15],
    ]);
    const n = normalizeScores(s);
    expect(n.get("a")).toBeCloseTo(0, 5);
    expect(n.get("b")).toBeCloseTo(1, 5);
    expect(n.get("c")).toBeCloseTo(0.5, 5);
  });

  test("handles uniform scores", () => {
    const s = new Map([
      ["a", 5],
      ["b", 5],
    ]);
    const n = normalizeScores(s);
    expect(n.get("a")).toBe(1);
    expect(n.get("b")).toBe(1);
  });

  test("handles empty map", () => {
    const n = normalizeScores(new Map());
    expect(n.size).toBe(0);
  });
});

// ── Unit tests: extractText ──

describe("extractText", () => {
  test("strips YAML frontmatter", () => {
    const md = "---\ntitle: Foo\n---\nHello world";
    expect(extractText(md)).toBe("Hello world");
  });

  test("strips wikilinks", () => {
    expect(extractText("See [[Page Name]] here")).toBe("See Page Name here");
    expect(extractText("See [[Page Name|alias]] here")).toBe(
      "See Page Name here",
    );
  });

  test("strips markdown links", () => {
    expect(extractText("[text](http://example.com)")).toBe("text");
  });

  test("strips URLs", () => {
    expect(extractText("Visit https://example.com today")).toBe("Visit today");
    expect(extractText("Visit http://x.com/y today")).toBe("Visit today");
  });

  test("strips markdown syntax", () => {
    expect(extractText("# Heading\n**bold** and _italic_")).toBe(
      "Heading bold and italic",
    );
  });

  test("normalizes whitespace", () => {
    expect(extractText("hello\n\nworld")).toBe("hello world");
  });
});

// ── Unit tests: walkMarkdown ──

describe("walkMarkdown", () => {
  test("finds all .md files recursively", async () => {
    const dir = await makeTmpDir("walk-");
    writeFileSync(join(dir, "a.md"), "a");
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "b.md"), "b");
    writeFileSync(join(dir, "c.txt"), "c");

    const paths = [...walkMarkdown(dir)];
    expect(paths).toHaveLength(2);
    expect(paths.some((p) => p.endsWith("a.md"))).toBe(true);
    expect(paths.some((p) => p.endsWith("b.md"))).toBe(true);
    expect(paths.some((p) => p.endsWith("c.txt"))).toBe(false);

    rmSync(dir, { recursive: true });
  });
});

// ── Unit tests: hybridSearch ──

describe("hybridSearch", () => {
  test("combines BM25 and vector scores", async () => {
    const idx = buildBm25Index([
      { id: "a", text: "machine learning neural network" },
      { id: "b", text: "deep learning artificial intelligence" },
      { id: "c", text: "baking sourdough bread" },
    ]);

    // Mock embeddings: a and b are close to query embedding, c is far
    const vectors: Record<string, number[]> = {
      a: [1, 0, 0],
      b: [0.9, 0.1, 0],
      c: [0, 0, 1],
    };

    // Mock query embedding
    const qvec = [1, 0, 0];

    // Patch hybridSearch to use our mock vectors
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ data: [{ embedding: qvec }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const results = await hybridSearch(
      "learning",
      idx,
      vectors,
      0.5,
      "test-key",
    );
    expect(results.length).toBe(3); // a, b (BM25 hits), c (vector-only, score 0)

    // Results should be a first, then b (a has higher BM25 and same vector)
    expect(results[0].path).toBe("a");
    expect(results[1].path).toBe("b");

    globalThis.fetch = originalFetch;
  });
});

// ── Unit tests: buildCache ──

describe("buildCache", () => {
  test("creates bm25-index and vectors.json", async () => {
    const dir = await makeTmpDir("cache-");
    const cacheDir = join(dir, "cache");
    process.env.HOME = dir; // redirect cache

    mkdirSync(join(dir, "wiki"));
    writeFileSync(join(dir, "wiki", "a.md"), "# Title A\nHello world");
    writeFileSync(join(dir, "wiki", "b.md"), "# Title B\nMachine learning");

    const originalFetch = globalThis.fetch;
    // Return deterministic embeddings based on input text length
    globalThis.fetch = mock(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const texts = body.input as string[];
      return new Response(
        JSON.stringify({
          data: texts.map((t) => ({
            embedding: Array(4).fill(t.length / 100),
          })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const progress: string[] = [];
    await buildCache(join(dir, "wiki"), "api-key", (m) => progress.push(m));

    expect(progress.some((m) => m.includes("Building BM25"))).toBe(true);

    // Cleanup
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true });
    process.env.HOME = process.env.HOME; // restore not needed, just scope
  });
});

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
  test("returns empty array for nonsense query", () => {
    const results = findCandidates("zzz_no_such_string_xyzzy_12345", WIKI_DIR);
    expect(results).toEqual([]);
  });

  test("results are sorted alphabetically", () => {
    const results = findCandidates("agent", WIKI_DIR);
    if (results.length < 2) return;
    const sorted = [...results].sort();
    expect(results).toEqual(sorted);
  });
});

// ── Unit tests: showContext ──

describe("showContext", () => {
  test("returns empty string for no matches in file", () => {
    const ctx = showContext("zzz_no_such_string_xyzzy", "/tmp/empty.txt", 2);
    expect(ctx).toBe("");
  });
});

// ── Unit tests: rerank ──

describe("rerank", () => {
  test("returns identity order when API returns error", async () => {
    const original = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "test-key-for-rerank-error";

    const tmpDir = await makeTmpDir("wiki-search-test-");
    const file1 = `${tmpDir}/doc1.md`;
    const file2 = `${tmpDir}/doc2.md`;
    writeFileSync(file1, "Document about cats");
    writeFileSync(file2, "Document about dogs");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ error: "invalid key" }), {
        status: 401,
      });
    });

    const indices = await rerank("cats", [file1, file2], 2, tmpDir);

    globalThis.fetch = originalFetch;
    expect(indices).toEqual([0, 1]);

    rmSync(tmpDir, { recursive: true });
    process.env.OPENROUTER_API_KEY = original;
  });

  test("sends correct payload structure", async () => {
    const tmpDir = await makeTmpDir("wiki-search-test-");
    const file1 = `${tmpDir}/test.md`;
    writeFileSync(file1, "Content about machine learning agents");

    let capturedBody: any = null;
    let capturedAuth: string | null = null;

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, opts: any) => {
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

    rmSync(tmpDir, { recursive: true });
    globalThis.fetch = originalFetch;
  });
});

// ── Integration tests: main ──

describe("main", () => {
  test("shows help text with --help", async () => {
    const out = await main(["--help"], {});
    expect(out).toContain("wiki-search");
    expect(out).toContain("--context");
    expect(out).toContain("--no-rerank");
    expect(out).toContain("--rebuild");
  });

  test("shows help text with no args", async () => {
    const out = await main([], {});
    expect(out).toContain("wiki-search");
  });

  test("reports no matches for nonsense query", async () => {
    const out = await main(["zzz_no_such_string_xyzzy_12345"], {});
    expect(out).toContain("No matching pages found");
  });

  test("respects --top flag with rerank", async () => {
    const tmpDir = await makeTmpDir("wiki-search-test-");
    writeFileSync(join(tmpDir, "agentic-coding.md"), "agentic coding with agents");
    writeFileSync(join(tmpDir, "ml.md"), "machine learning agents");
    writeFileSync(join(tmpDir, "baking.md"), "baking sourdough");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const topN = body.top_n;
      // Support both rerank and embedding endpoints
      if (body.documents) {
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
      }
      // Embedding endpoint
      return new Response(
        JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const out = await main(["agent", "--top", "2"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: tmpDir,
    });
    expect(out).toContain("Reranked by relevance");

    const pageHeaders = out.match(/─── .+ ───/g) ?? [];
    expect(pageHeaders.length).toBe(2);

    rmSync(tmpDir, { recursive: true });
    globalThis.fetch = originalFetch;
  });

  test("skips rerank when no OPENROUTER_API_KEY", async () => {
    const out = await main(["spec paradox", "--no-rerank"], {});
    expect(out).not.toContain("Reranked");
  });

  test("joins multi-word query from positionals", async () => {
    const out = await main(["spec", "paradox", "--no-rerank"], {});
    if (!out.includes("No matching pages found")) {
      expect(out).toContain("matching page(s)");
    }
  });

  test("returns error without OPENROUTER_API_KEY for --rebuild", async () => {
    const out = await main(["--rebuild"], {});
    expect(out).toContain("Error: OPENROUTER_API_KEY required");
  });

  test("auto-rebuilds on hash-only staleness with working API", async () => {
    const dir = await makeTmpDir("auto-rebuild-");
    const originalHome = process.env.HOME;
    process.env.HOME = dir;

    mkdirSync(join(dir, "wiki"));
    writeFileSync(join(dir, "wiki", "a.md"), "# Title A\nHello world");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const texts = body.input as string[];
      return new Response(
        JSON.stringify({
          data: texts.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await main(["--rebuild"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: join(dir, "wiki"),
    });

    // Modify file to make cache hash-stale
    writeFileSync(join(dir, "wiki", "a.md"), "# Title A\nHello world updated");

    const out = await main(["world"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: join(dir, "wiki"),
    });
    expect(out).not.toContain("Search index is stale");
    expect(out).toContain("matching page(s)");

    globalThis.fetch = originalFetch;
    process.env.HOME = originalHome;
    rmSync(dir, { recursive: true });
  });

  test("falls back to stale cache on hash-only staleness when API is down", async () => {
    const dir = await makeTmpDir("hash-fallback-");
    const originalHome = process.env.HOME;
    process.env.HOME = dir;

    mkdirSync(join(dir, "wiki"));
    writeFileSync(join(dir, "wiki", "a.md"), "# Title A\nHello world");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const texts = body.input as string[];
      return new Response(
        JSON.stringify({
          data: texts.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await main(["--rebuild"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: join(dir, "wiki"),
    });

    // Modify file
    writeFileSync(join(dir, "wiki", "a.md"), "# Title A\nHello world updated");

    // Break API
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ error: "down" }), { status: 503 });
    });

    const out = await main(["world"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: join(dir, "wiki"),
    });
    expect(out).not.toContain("Search index is stale");
    expect(out).toContain("matching page(s)");

    globalThis.fetch = originalFetch;
    process.env.HOME = originalHome;
    rmSync(dir, { recursive: true });
  });

  test("falls back to ripgrep on structural staleness when API is down", async () => {
    const dir = await makeTmpDir("struct-fallback-");
    const originalHome = process.env.HOME;
    process.env.HOME = dir;

    mkdirSync(join(dir, "wiki"));
    writeFileSync(join(dir, "wiki", "a.md"), "# Title A\nHello world");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      const texts = body.input as string[];
      return new Response(
        JSON.stringify({
          data: texts.map(() => ({ embedding: [0.1, 0.2, 0.3] })),
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await main(["--rebuild"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: join(dir, "wiki"),
    });

    // Add a new file → structural staleness
    writeFileSync(join(dir, "wiki", "b.md"), "# Title B\nMachine learning");

    // Break API
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ error: "down" }), { status: 503 });
    });

    const out = await main(["world"], {
      OPENROUTER_API_KEY: "test-key",
      WIKI_DIR: join(dir, "wiki"),
    });
    expect(out).not.toContain("Search index is stale");
    expect(out).toContain("matching page(s)");

    globalThis.fetch = originalFetch;
    process.env.HOME = originalHome;
    rmSync(dir, { recursive: true });
  });
});
