import { describe, expect, it } from "bun:test";
import { FileIndex } from "./file-index";
import type { FileEntry } from "./file-index";
import type { QueryPlan } from "./query-planner";

function makeEntry(overrides: Partial<FileEntry> & { path: string }): FileEntry {
  return {
    path: overrides.path,
    language: "typescript",
    symbols: [],
    description: "",
    imports: [],
    exports: [],
    size: 100,
    mtimeMs: Date.now(),
    ...overrides,
  };
}

function buildPlan(overrides: Partial<QueryPlan>): QueryPlan {
  return {
    intent: "define",
    entities: [],
    grepTerms: [],
    filePatterns: ["*.ts"],
    scopeHints: [],
    avoidTerms: [],
    ...overrides,
  };
}

describe("FileIndex.search", () => {
  it("ranks path matches above non-matches", () => {
    const index = new FileIndex("/tmp");
    (index as any).files.set("src/parser.ts", makeEntry({ path: "src/parser.ts" }));
    (index as any).files.set("src/ui.ts", makeEntry({ path: "src/ui.ts" }));

    const plan = buildPlan({ grepTerms: ["parser"] });
    const results = index.search(plan);
    expect(results[0]?.path).toBe("src/parser.ts");
    expect(results[0]?.score).toBeGreaterThan(0);
  });

  it("gives higher weight to exact entity symbol matches", () => {
    const index = new FileIndex("/tmp");
    (index as any).files.set(
      "src/parser.ts",
      makeEntry({
        path: "src/parser.ts",
        symbols: [{ name: "parseQuestions", kind: "function", start: 0, end: 10 }],
      }),
    );
    (index as any).files.set(
      "src/ui.ts",
      makeEntry({
        path: "src/ui.ts",
        symbols: [{ name: "runUI", kind: "function", start: 0, end: 10 }],
      }),
    );

    const plan = buildPlan({ entities: ["parseQuestions"] });
    const results = index.search(plan);
    expect(results[0]?.path).toBe("src/parser.ts");
    expect(results[0]?.score).toBeGreaterThan(
      results.find((r) => r.path === "src/ui.ts")?.score ?? 0,
    );
  });

  it("boosts files whose description mentions an entity", () => {
    const index = new FileIndex("/tmp");
    (index as any).files.set(
      "src/subagent.ts",
      makeEntry({
        path: "src/subagent.ts",
        description: "In-process subagent runner using the pi SDK",
      }),
    );
    (index as any).files.set(
      "src/util.ts",
      makeEntry({ path: "src/util.ts", description: "Shared utilities" }),
    );

    const plan = buildPlan({ entities: ["subagent"] });
    const results = index.search(plan);
    expect(results[0]?.path).toBe("src/subagent.ts");
    expect(results[0]?.reasons).toContain("description mentions: subagent");
  });

  it("applies higher caller boost for 'use' intent", () => {
    const index = new FileIndex("/tmp");
    (index as any).files.set(
      "src/parser.ts",
      makeEntry({
        path: "src/parser.ts",
        symbols: [{ name: "parse", kind: "function", start: 0, end: 10 }],
      }),
    );
    (index as any).files.set(
      "src/caller.ts",
      makeEntry({
        path: "src/caller.ts",
        imports: ["./parser"],
        symbols: [{ name: "main", kind: "variable", start: 0, end: 10 }],
      }),
    );
    (index as any).importedBy.set("src/parser.ts", new Set(["src/caller.ts"]));

    const definePlan = buildPlan({ intent: "define", grepTerms: ["caller"] });
    const usePlan = buildPlan({ intent: "use", grepTerms: ["caller"] });

    const defineResults = index.search(definePlan);
    const useResults = index.search(usePlan);

    const callerDefine = defineResults.find((r) => r.path === "src/caller.ts");
    const callerUse = useResults.find((r) => r.path === "src/caller.ts");

    expect(callerUse?.score ?? 0).toBeGreaterThan(callerDefine?.score ?? 0);
    expect(callerUse?.reasons).toContain("import proximity");
  });

  it("applies second-order proximity boost", () => {
    const index = new FileIndex("/tmp");
    // 11 dummy files with higher scores to push mid/leaf outside topPaths
    for (let i = 0; i < 11; i++) {
      (index as any).files.set(
        `src/dummy${i}.ts`,
        makeEntry({
          path: `src/dummy${i}.ts`,
          symbols: [{ name: `dummy${i}`, kind: "function", start: 0, end: 10 }],
        }),
      );
    }

    (index as any).files.set(
      "src/core.ts",
      makeEntry({
        path: "src/core.ts",
        symbols: [{ name: "core", kind: "function", start: 0, end: 10 }],
      }),
    );
    (index as any).files.set("src/mid.ts", makeEntry({ path: "src/mid.ts", imports: ["./core"] }));
    (index as any).files.set("src/leaf.ts", makeEntry({ path: "src/leaf.ts", imports: ["./mid"] }));

    (index as any).importedBy.set("src/core.ts", new Set(["src/mid.ts"]));
    (index as any).importedBy.set("src/mid.ts", new Set(["src/leaf.ts"]));

    const plan = buildPlan({ entities: ["core"] });
    const results = index.search(plan);

    const leaf = results.find((r) => r.path === "src/leaf.ts");
    expect(leaf?.score ?? 0).toBeGreaterThan(0);
    expect(leaf?.reasons).toContain("second-order proximity");
  });
});
