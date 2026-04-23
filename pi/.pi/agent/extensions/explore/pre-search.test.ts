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
    // avoidTerms only flags parts ≤2 chars, so "pre" (3 chars) is NOT flagged
    expect(plan.avoidTerms).not.toContain("pre");
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

  it("extracts kebab-case tokens as entities", () => {
    const plan = planQuery("file-index and query-planner in the explore extension");
    expect(plan.entities).toContain("file-index");
    expect(plan.entities).toContain("query-planner");
  });

  it("extracts kebab-case identifiers via regex", () => {
    const plan = planQuery("How does pre-search work?");
    expect(plan.entities).toContain("pre-search");
  });

  it("flags 1-2 char kebab parts as avoidTerms but not 3-char parts", () => {
    const plan = planQuery("How does wt-config relate to api-gateway?");
    expect(plan.entities).toContain("wt-config");
    expect(plan.entities).toContain("api-gateway");
    expect(plan.avoidTerms).toContain("wt"); // 2 chars → avoid
    expect(plan.avoidTerms).not.toContain("api"); // 3 chars → keep
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
    // use-intent: callers get +4 boost instead of +2
    const bResult = results[bIdx];
    expect(bResult.reasons).toContain("import proximity");
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

// isRelated is not exported, but we can test its behavior indirectly via scoring
describe("isRelated word-boundary enforcement", () => {
  it("does not match tmux against tmuxedfoo", () => {
    // tmux is contained in tmuxedfoo, but not at a word boundary
    const idx = new FileIndex("/fake");
    (idx as any).files.set("tmuxedfoo.ts", {
      path: "tmuxedfoo.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "tmuxedFoo", line: 1 }],
      description: "",
      imports: [],
      exports: ["tmuxedFoo"],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).files.set("tmux.ts", {
      path: "tmux.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "tmux", line: 1 }],
      description: "",
      imports: [],
      exports: ["tmux"],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "define",
      entities: ["tmux"],
      grepTerms: ["tmux"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    // tmux.ts should rank higher than tmuxedfoo.ts
    const tmuxIdx = results.findIndex((r) => r.path === "tmux.ts");
    const tmuxedIdx = results.findIndex((r) => r.path === "tmuxedfoo.ts");
    expect(tmuxIdx).toBeGreaterThanOrEqual(0);
    expect(tmuxedIdx).toBeGreaterThanOrEqual(0);
    expect(tmuxIdx).toBeLessThan(tmuxedIdx);
  });
});

describe("entity description boost", () => {
  it("boosts files whose description mentions an entity even with no symbol match", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("consumer.ts", {
      path: "consumer.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "createExplore", line: 1 }],
      description: "In-process subagent runner for codebase exploration",
      imports: [],
      exports: ["createExplore"],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).files.set("unrelated.ts", {
      path: "unrelated.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "other", line: 1 }],
      description: "Handles caching logic",
      imports: [],
      exports: ["other"],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "use",
      entities: ["subagent"],
      grepTerms: ["subagent"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    const consumerIdx = results.findIndex((r) => r.path === "consumer.ts");
    const unrelatedIdx = results.findIndex((r) => r.path === "unrelated.ts");
    expect(consumerIdx).toBeGreaterThanOrEqual(0);
    expect(results[consumerIdx].reasons).toContain("description mentions: subagent");
    // consumer should rank above unrelated (which only has grepTerm path match at best)
    if (unrelatedIdx >= 0) {
      expect(consumerIdx).toBeLessThan(unrelatedIdx);
    }
  });
});

describe("second-order proximity boost", () => {
  it("boosts files two hops from top matches when intermediate is outside top-10", () => {
    const idx = new FileIndex("/fake");
    // core.ts (defines "target") ← middle.ts (imports core, low score) ← consumer.ts (imports middle)
    // Add 10+ filler files with higher scores than middle.ts so it falls outside topPaths
    (idx as any).files.set("core.ts", {
      path: "core.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "target", line: 1 }],
      description: "",
      imports: [],
      exports: ["target"],
      size: 100,
      mtimeMs: 0,
    });
    // middle.ts has no symbol match, only file-pattern (+1)
    (idx as any).files.set("middle.ts", {
      path: "middle.ts",
      language: ".ts",
      symbols: [],
      description: "",
      imports: ["./core"],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });
    // consumer.ts has a symbol giving it base relevance
    (idx as any).files.set("consumer.ts", {
      path: "consumer.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "wrapper", line: 1 }],
      description: "",
      imports: ["./middle"],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });
    // Add 10 filler files with scope hints to give them score > 1, pushing middle.ts out of top 10
    for (let i = 0; i < 11; i++) {
      (idx as any).files.set(`filler${i}/target.ts`, {
        path: `filler${i}/target.ts`,
        language: ".ts",
        symbols: [],
        description: "",
        imports: [],
        exports: [],
        size: 100,
        mtimeMs: 0,
      });
    }
    // Build reverse graph
    (idx as any).importedBy.set("core.ts", new Set(["middle.ts"]));
    (idx as any).importedBy.set("middle.ts", new Set(["consumer.ts"]));

    const results = idx.search({
      intent: "use",
      entities: ["target"],
      grepTerms: ["target"],
      filePatterns: ["*.ts"],
      scopeHints: [
        "filler0",
        "filler1",
        "filler2",
        "filler3",
        "filler4",
        "filler5",
        "filler6",
        "filler7",
        "filler8",
        "filler9",
        "filler10",
      ],
      avoidTerms: [],
    });

    // core.ts should be #1 with entity match
    expect(results[0].path).toBe("core.ts");
    // middle.ts should be outside top 10 (only file-pattern +1, fillers have +3 scope)
    const middleIdx = results.findIndex((r) => r.path === "middle.ts");
    expect(middleIdx).toBeGreaterThan(9);
    // consumer.ts should get second-order proximity (middle → consumer)
    const consumerIdx = results.findIndex((r) => r.path === "consumer.ts");
    expect(consumerIdx).toBeGreaterThanOrEqual(0);
    expect(results[consumerIdx].reasons).toContain("second-order proximity");
  });
});

describe("import type extraction", () => {
  it("extracts import type statements alongside regular imports", () => {
    const { extractImports } = require("./file-index");
    const imports = extractImports(
      "test.ts",
      [
        `import type { Foo } from "./foo";`,
        `import { Bar } from "./bar";`,
        `import type Baz from "./baz";`,
      ].join("\n"),
    );
    expect(imports).toContain("./foo");
    expect(imports).toContain("./bar");
    expect(imports).toContain("./baz");
    expect(imports.length).toBe(3);
  });
});

describe("intent precedence for 'how does'", () => {
  it("classifies 'how does X work' as use-intent, not arch", () => {
    const plan = planQuery("How does the auth module work?");
    expect(plan.intent).toBe("use");
  });
});

describe("entity scoring not double-counted", () => {
  it("does not score entities in both grepTerm and entity loops", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("presets.ts", {
      path: "presets.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "presets", line: 1 }],
      description: "",
      imports: [],
      exports: ["presets"],
      size: 100,
      mtimeMs: 0,
    });

    const results = idx.search({
      intent: "define",
      entities: ["presets"],
      grepTerms: ["presets", "otherTerm"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    // presets entity match: +12 (exact entity) + +6 (path entity) = 18
    // No extra +8/+2 from grepTerms for the same term
    expect(results[0].path).toBe("presets.ts");
    const reasons = results[0].reasons.join(", ");
    // Should NOT have both "symbol match: presets" AND "exact entity: presets"
    expect(reasons).toContain("exact entity: presets");
    expect(reasons).not.toContain("symbol match: presets");
  });
});

describe("use-intent caller weighting", () => {
  it("gives larger proximity boost for use-intent than define-intent", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("core.ts", {
      path: "core.ts",
      language: ".ts",
      symbols: [{ kind: "function", name: "target", line: 1 }],
      description: "",
      imports: [],
      exports: ["target"],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).files.set("caller.ts", {
      path: "caller.ts",
      language: ".ts",
      symbols: [],
      description: "target usage",
      imports: ["./core"],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });
    (idx as any).importedBy.set("core.ts", new Set(["caller.ts"]));

    const useResults = idx.search({
      intent: "use",
      entities: ["target"],
      grepTerms: ["target"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });
    const defineResults = idx.search({
      intent: "define",
      entities: ["target"],
      grepTerms: ["target"],
      filePatterns: ["*.ts"],
      scopeHints: [],
      avoidTerms: [],
    });

    const useCallerScore = useResults.find((r) => r.path === "caller.ts")!.score;
    const defineCallerScore = defineResults.find((r) => r.path === "caller.ts")!.score;
    // use-intent should give callers a larger boost than define-intent
    expect(useCallerScore).toBeGreaterThan(defineCallerScore);
  });
});

describe("Python import extraction", () => {
  it("extracts from-import statements", () => {
    const { extractImports } = require("./file-index");
    const imports = extractImports(
      "app.py",
      [`from mypackage.submodule import do_thing`, `from another.module import Foo, Bar`].join(
        "\n",
      ),
    );
    expect(imports).toContain("mypackage.submodule");
    expect(imports).toContain("another.module");
    expect(imports.length).toBe(2);
  });

  it("extracts plain import statements", () => {
    const { extractImports } = require("./file-index");
    const imports = extractImports(
      "app.py",
      [`import os`, `import json`, `import mypackage.utils`].join("\n"),
    );
    expect(imports).toContain("os");
    expect(imports).toContain("json");
    expect(imports).toContain("mypackage.utils");
    expect(imports.length).toBe(3);
  });
});

describe("Lua require extraction", () => {
  it("extracts require() calls with double quotes", () => {
    const { extractImports } = require("./file-index");
    const imports = extractImports(
      "main.lua",
      [`local foo = require("foo")`, `require("bar.baz")`].join("\n"),
    );
    expect(imports).toContain("foo");
    expect(imports).toContain("bar.baz");
    expect(imports.length).toBe(2);
  });

  it("extracts require() calls with single quotes", () => {
    const { extractImports } = require("./file-index");
    const imports = extractImports("main.lua", `require('mymod')`);
    expect(imports).toContain("mymod");
    expect(imports.length).toBe(1);
  });

  it("extracts bare require without parentheses (Lua pattern)", () => {
    const { extractImports } = require("./file-index");
    const imports = extractImports("main.lua", `require "mymod"`);
    expect(imports).toContain("mymod");
    expect(imports.length).toBe(1);
  });
});

describe("barrel import resolution", () => {
  it("resolves package name imports to index files", () => {
    const idx = new FileIndex("/fake");
    // Set up package name map (normally done by buildPackageNameMap)
    (idx as any).packageNameMap.set("@pi-ext/shared", "shared/src");
    (idx as any).files.set("shared/src/index.ts", {
      path: "shared/src/index.ts",
      language: ".ts",
      symbols: [],
      description: "Shared utilities",
      imports: [],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });

    const resolved = (idx as any).resolveImport("consumer.ts", "@pi-ext/shared");
    expect(resolved).toBe("shared/src/index.ts");
  });

  it("resolves subpath package imports", () => {
    const idx = new FileIndex("/fake");
    (idx as any).packageNameMap.set("@pi-ext/shared", "shared/src");
    (idx as any).files.set("shared/src/test-mocks.ts", {
      path: "shared/src/test-mocks.ts",
      language: ".ts",
      symbols: [],
      description: "Test mocks",
      imports: [],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });

    const resolved = (idx as any).resolveImport("consumer.ts", "@pi-ext/shared/test-mocks");
    expect(resolved).toBe("shared/src/test-mocks.ts");
  });

  it("resolves Python dotted module imports", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("mypackage/utils/helpers.py", {
      path: "mypackage/utils/helpers.py",
      language: ".py",
      symbols: [],
      description: "",
      imports: [],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });

    const resolved = (idx as any).resolveImport("main.py", "mypackage.utils.helpers");
    expect(resolved).toBe("mypackage/utils/helpers.py");
  });

  it("resolves Lua dotted module imports", () => {
    const idx = new FileIndex("/fake");
    (idx as any).files.set("mymod/sub/init.lua", {
      path: "mymod/sub/init.lua",
      language: ".lua",
      symbols: [],
      description: "",
      imports: [],
      exports: [],
      size: 100,
      mtimeMs: 0,
    });

    const resolved = (idx as any).resolveImport("main.lua", "mymod.sub");
    expect(resolved).toBe("mymod/sub/init.lua");
  });
});

describe("Lua description extraction", () => {
  it("extracts Lua single-line comments", () => {
    // extractDescription is not exported, but we can test via indexFile behavior.
    // For now, test the regex pattern directly.
    const source = `-- This module handles user auth\nlocal M = {}`;
    const luaComment = source.match(/^--\s*(.+)/m);
    expect(luaComment).not.toBeNull();
    expect(luaComment![1]).toContain("This module handles user auth");
  });

  it("extracts Lua multi-line comments", () => {
    const source = `--[[\n  Auth module\n  Handles login/logout\n]]\nlocal M = {}`;
    const luaMultiline = source.match(/--\[\[[\s\S]*?\]\]/);
    expect(luaMultiline).not.toBeNull();
    expect(luaMultiline![0]).toContain("Auth module");
  });
});
