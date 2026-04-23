import { describe, it, expect } from "bun:test";
import { planQuery } from "./query-planner";
import { FileIndex } from "./file-index";

describe("planQuery", () => {
  it("extracts quoted strings as entities", () => {
    const plan = planQuery(`Look for "delivery tracker" and 'bezorging'`);
    expect(plan.entities).toContain("delivery tracker");
    expect(plan.entities).toContain("bezorging");
  });

  it("extracts distinctive code identifiers", () => {
    const plan = planQuery("inruimen delivery tracker components stores");
    expect(plan.grepTerms).toContain("inruimen");
    expect(plan.grepTerms).toContain("delivery");
    expect(plan.grepTerms).toContain("tracker");
  });

  it("extracts lowercase distinctive nouns as entities", () => {
    const plan = planQuery("pi subagent extensions skills agent harness");
    expect(plan.entities).toContain("subagent");
    expect(plan.entities).toContain("extensions");
    expect(plan.entities).toContain("skills");
    expect(plan.entities).toContain("harness");
    expect(plan.entities).toContain("agent");
    expect(plan.entities).not.toContain("pi"); // too short
  });

  it("filters out stop words", () => {
    const plan = planQuery("find all the components related to delivery");
    expect(plan.grepTerms).not.toContain("find");
    expect(plan.grepTerms).not.toContain("all");
    expect(plan.grepTerms).not.toContain("the");
    expect(plan.grepTerms).not.toContain("related");
    expect(plan.grepTerms).toContain("components");
    expect(plan.grepTerms).toContain("delivery");
  });

  it("filters out words shorter than 4 chars", () => {
    const plan = planQuery("API routes in the app");
    expect(plan.grepTerms).not.toContain("in");
    expect(plan.grepTerms).toContain("API");
    expect(plan.grepTerms).toContain("routes");
    expect(plan.grepTerms).toContain("app");
  });

  it("limits grepTerms to 8 terms", () => {
    const plan = planQuery(
      "delivery tracker bezorging tracking status progress route component store composable",
    );
    expect(plan.grepTerms.length).toBeLessThanOrEqual(8);
  });

  it("deduplicates case-insensitively", () => {
    const plan = planQuery("Delivery delivery DELIVERY");
    expect(plan.grepTerms.filter((t) => t.toLowerCase() === "delivery").length).toBe(1);
  });

  it("strips text after injected markers", () => {
    const plan = planQuery(
      "delivery tracker\n[Constraints: thoroughness=medium, max 80 tool calls]",
    );
    expect(plan.grepTerms).not.toContain("Constraints");
    expect(plan.grepTerms).not.toContain("thoroughness");
    expect(plan.grepTerms).toContain("delivery");
    expect(plan.grepTerms).toContain("tracker");
  });

  it("classifies intent as 'define' for definition queries", () => {
    const plan = planQuery("Where is the UserModel class defined?");
    expect(plan.intent).toBe("define");
  });

  it("classifies intent as 'use' for usage queries", () => {
    const plan = planQuery("How do I use the sendEmail function?");
    expect(plan.intent).toBe("use");
  });

  it("classifies intent as 'arch' for architecture queries", () => {
    const plan = planQuery("What is the overall architecture of the auth system?");
    expect(plan.intent).toBe("arch");
  });

  it("classifies intent as 'change' for modification queries", () => {
    const plan = planQuery("How should I refactor this auth middleware?");
    expect(plan.intent).toBe("change");
  });

  it("extracts snake_case entities as whole terms", () => {
    const plan = planQuery("How does pre_search work?");
    expect(plan.entities).toContain("pre_search");
    expect(plan.avoidTerms).toContain("pre");
  });

  it("infers file patterns from context", () => {
    const plan = planQuery("Docker compose healthcheck syntax");
    expect(plan.filePatterns).toContain("*.yaml");
    expect(plan.filePatterns).toContain("docker-compose.*");
  });

  it("extracts scope hints from paths", () => {
    const plan = planQuery("Find the auth logic in agent/extensions/explore");
    expect(plan.scopeHints).toContain("agent/extensions/explore");
  });
});

describe("FileIndex scoring", () => {
  it("ranks files with exact entity matches highest", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("a.ts", {
      path: "a.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "preSearch", line: 1 }],
      description: "",
      imports: [],
      exports: ["preSearch"],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).files.set("b.ts", {
      path: "b.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "otherFn", line: 1 }],
      description: "",
      imports: [],
      exports: ["otherFn"],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "define",
      entities: ["preSearch"],
      grepTerms: ["preSearch"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    expect(results[0].path).toBe("a.ts");
    expect(results[0].reasons).toContain("exact entity: preSearch");
  });

  it("gives proximity boost to files that import top matches", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("a.ts", {
      path: "a.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "target", line: 1 }],
      description: "",
      imports: [],
      exports: ["target"],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).files.set("b.ts", {
      path: "b.ts",
      language: ".ts",
      symbols: [],
      description: "",
      imports: ["./a"],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });
    // Build the reverse graph manually
    (idx as any).importedBy.set("a.ts", new Set(["b.ts"]));

    const results = idx.search({
      intent: "use",
      entities: ["target"],
      grepTerms: ["target"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    // a.ts should be first, b.ts should appear with proximity boost
    const aIdx = results.findIndex((r) => r.path === "a.ts");
    const bIdx = results.findIndex((r) => r.path === "b.ts");
    expect(aIdx).toBe(0);
    expect(bIdx).toBeGreaterThanOrEqual(0);
    expect(results[bIdx].reasons).toContain("import proximity");
  });

  it("applies scope hint boost", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("explore/index.ts", {
      path: "explore/index.ts",
      language: ".ts",
      symbols: [],
      description: "",
      imports: [],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).files.set("other/index.ts", {
      path: "other/index.ts",
      language: ".ts",
      symbols: [],
      description: "",
      imports: [],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "define",
      entities: [],
      grepTerms: [],
      filePatterns: ["*.ts"],
      scopeHints: ["explore"],
      avoidTerms: [],
    });

    const exploreIdx = results.findIndex((r) => r.path === "explore/index.ts");
    expect(exploreIdx).toBe(0);
    expect(results[exploreIdx].reasons).toContain("scope: explore");
  });
});

describe("FileIndex scoring with stemming", () => {
  it("matches plural queries to singular symbols", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("subagent.ts", {
      path: "subagent.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "runSubagent", line: 1 }],
      description: "In-process subagent runner",
      imports: [],
      exports: ["runSubagent"],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "define",
      entities: ["subagents"],
      grepTerms: ["subagents"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe("subagent.ts");
    expect(results[0].reasons.some((r) => r.includes("runSubagent"))).toBe(true);
  });

  it("matches stemmed terms (configuration → config)", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("config.ts", {
      path: "config.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "getConfig", line: 1 }],
      description: "Configuration helpers",
      imports: [],
      exports: ["getConfig"],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "define",
      entities: ["configuration"],
      grepTerms: ["configuration"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].path).toBe("config.ts");
  });
});

describe("preSearch result stats", () => {
  it.todo("returns stats alongside text results");
});
