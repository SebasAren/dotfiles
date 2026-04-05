import { describe, it, expect, mock, beforeEach } from "bun:test";
import {
	piCodingAgentMock,
	piTuiRenderMock,
	typeboxMock,
} from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiRenderMock);
mock.module("@sinclair/typebox", typeboxMock);

import wtWorktreeExtension, {
  generateBranchName,
  formatDuration,
} from "./index";

// ---------------------------------------------------------------------------
// Pure helpers (re-exported from wt-cli.ts via index.ts)
// ---------------------------------------------------------------------------

describe("generateBranchName", () => {
  it("produces a branch prefixed with 'agent/'", () => {
    expect(generateBranchName("fix login bug")).toMatch(/^agent\//);
  });

  it("slugifies the task into lowercase words", () => {
    const name = generateBranchName("Fix Login Bug");
    expect(name).toMatch(/^agent\/fix-login-bug-/);
  });

  it("limits to 5 words from the task", () => {
    const name = generateBranchName("one two three four five six seven");
    const slug = name.split("/")[1].split("-").slice(0, -1).join("-");
    expect(slug).toBe("one-two-three-four-five");
  });

  it("strips non-alphanumeric characters", () => {
    const name = generateBranchName("fix: refactor `foo()` & bar!");
    expect(name).toMatch(/^agent\/fix-refactor-foo-bar-/);
  });

  it("falls back to 'task' for empty or non-alphanumeric input", () => {
    const name = generateBranchName("!@#$%^&*()");
    expect(name).toMatch(/^agent\/task-/);
  });

  it("appends a unique suffix (base-36 timestamp)", async () => {
    const a = generateBranchName("same task");
    await new Promise((r) => setTimeout(r, 2));
    const b = generateBranchName("same task");
    expect(a).not.toBe(b);
  });
});

describe("formatDuration", () => {
  it("formats seconds under 60", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(500)).toBe("1s");
    expect(formatDuration(30_000)).toBe("30s");
    expect(formatDuration(59_499)).toBe("59s");
  });

  it("formats minutes and seconds for >= 60s", () => {
    expect(formatDuration(60_000)).toBe("1m0s");
    expect(formatDuration(90_000)).toBe("1m30s");
    expect(formatDuration(600_000)).toBe("10m0s");
  });

  it("rounds to nearest second", () => {
    expect(formatDuration(1_500)).toBe("2s");
    expect(formatDuration(999)).toBe("1s");
  });
});

// ---------------------------------------------------------------------------
// Extension registration
// ---------------------------------------------------------------------------

describe("wt-worktree extension registration", () => {
  beforeEach(() => {
    delete process.env.WT_WORKTREE_CHILD;
  });

  it("registers a tool named 'wt_worktree_task'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
      registerCommand: mock(() => {}),
    };
    wtWorktreeExtension(mockApi as any);
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("wt_worktree_task");
  });

  it("skips registration in child processes", () => {
    process.env.WT_WORKTREE_CHILD = "1";
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    wtWorktreeExtension(mockApi as any);
    expect(mockApi.registerTool).not.toHaveBeenCalled();
    delete process.env.WT_WORKTREE_CHILD;
  });

  it("declares @pi-ext/shared as a workspace dependency", async () => {
    const pkg = await import("./package.json");
    expect(pkg.dependencies["@pi-ext/shared"]).toBe("workspace:*");
  });
});

// ---------------------------------------------------------------------------
// renderCall
// ---------------------------------------------------------------------------

describe("renderCall", () => {
  let tool: any;

  beforeEach(() => {
    delete process.env.WT_WORKTREE_CHILD;
    delete process.env.CHEAP_MODEL;

    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (t: any) => registeredTools.push(t),
      registerCommand: mock(() => {}),
    };
    wtWorktreeExtension(mockApi as any);
    tool = registeredTools[0];
  });

  function makeTheme() {
    return {
      fg: (_color: string, text: string) => `<${_color}>${text}</>`,
      bold: (text: string) => `<b>${text}</b>`,
    };
  }

  it("shows branch name and model", () => {
    const result = tool.renderCall(
      { task: "do something", branch: "fix-bug", model: "gpt-4" },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("fix-bug");
    expect(result.text).toContain("gpt-4");
  });

  it("falls back to '(auto)' when no branch given", () => {
    const result = tool.renderCall({ task: "do something" }, makeTheme(), {});
    expect(result.text).toContain("(auto)");
  });

  it("shows 'no auto-merge' warning when auto_merge is false", () => {
    const result = tool.renderCall(
      { task: "do something", auto_merge: false },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("no auto-merge");
  });

  it("reuses context.lastComponent when available", () => {
    const { Text } = require("@mariozechner/pi-tui");
    const existing = new Text("old", 0, 0);
    const result = tool.renderCall({ task: "do something" }, makeTheme(), {
      lastComponent: existing,
    });
    expect(result).toBe(existing);
    expect(result.text).not.toBe("old");
  });
});

// ---------------------------------------------------------------------------
// renderResult — collapsed
// ---------------------------------------------------------------------------

describe("renderResult — collapsed", () => {
  let tool: any;

  beforeEach(() => {
    delete process.env.WT_WORKTREE_CHILD;
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (t: any) => registeredTools.push(t),
      registerCommand: mock(() => {}),
    };
    wtWorktreeExtension(mockApi as any);
    tool = registeredTools[0];
  });

  function makeTheme() {
    return {
      fg: (_color: string, text: string) => `<${_color}>${text}</>`,
      bold: (text: string) => `<b>${text}</b>`,
    };
  }

  function makeResult(overrides: Record<string, any> = {}) {
    return {
      content: [{ type: "text", text: "Done implementing the feature." }],
      details: {
        branch: "agent/fix-123",
        worktreePath: "/tmp/test-worktree",
        subagentResult: {
          exitCode: 0,
          output: "Done implementing the feature.",
          stderr: "",
          usage: {
            input: 1000,
            output: 500,
            cacheRead: 0,
            cacheWrite: 0,
            cost: 0.05,
            contextTokens: 0,
            turns: 3,
          },
          model: "codestral",
        },
        durationMs: 45_000,
        autoMerge: true,
      },
      isError: false,
      ...overrides,
    };
  }

  it("shows success icon and branch in collapsed view", () => {
    const result = tool.renderResult(
      makeResult(),
      { expanded: false },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("✓");
    expect(result.text).toContain("agent/fix-123");
  });

  it("shows error icon when isError is true", () => {
    const result = tool.renderResult(
      makeResult({ isError: true }),
      { expanded: false },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("✗");
  });

  it("shows usage summary (turns, cost, model, duration)", () => {
    const result = tool.renderResult(
      makeResult(),
      { expanded: false },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("3t");
    expect(result.text).toContain("$0.0500");
    expect(result.text).toContain("codestral");
    expect(result.text).toContain("45s");
  });

  it("shows expand hint", () => {
    const result = tool.renderResult(
      makeResult(),
      { expanded: false },
      makeTheme(),
      {},
    );
    expect(result.text).toContain("Ctrl+O to expand");
  });
});

// ---------------------------------------------------------------------------
// renderResult — expanded
// ---------------------------------------------------------------------------

describe("renderResult — expanded", () => {
  let tool: any;

  beforeEach(() => {
    delete process.env.WT_WORKTREE_CHILD;
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (t: any) => registeredTools.push(t),
      registerCommand: mock(() => {}),
    };
    wtWorktreeExtension(mockApi as any);
    tool = registeredTools[0];
  });

  function makeTheme() {
    return {
      fg: (_color: string, text: string) => `<${_color}>${text}</>`,
      bold: (text: string) => `<b>${text}</b>`,
    };
  }

  function makeResult(overrides: Record<string, any> = {}) {
    return {
      content: [{ type: "text", text: "Implemented the changes." }],
      details: {
        branch: "agent/fix-456",
        worktreePath: "/home/user/project/.worktrees/fix-456",
        subagentResult: {
          exitCode: 0,
          output: "Implemented the changes.",
          stderr: "",
          usage: {
            input: 2000,
            output: 1000,
            cacheRead: 500,
            cacheWrite: 0,
            cost: 0.12,
            contextTokens: 0,
            turns: 5,
          },
          model: "gpt-4o",
        },
        durationMs: 120_000,
        autoMerge: true,
      },
      isError: false,
      ...overrides,
    };
  }

  it("returns a Container with children", () => {
    const result = tool.renderResult(
      makeResult(),
      { expanded: true },
      makeTheme(),
      {},
    );
    expect(result.children).toBeDefined();
    expect(result.children.length).toBeGreaterThan(0);
  });

  it("shows phase 'Complete' for successful runs", () => {
    const result = tool.renderResult(
      makeResult(),
      { expanded: true },
      makeTheme(),
      {},
    );
    const texts = result.children.map((c: any) => c.text);
    const phaseText = texts.find((t: string) => t.includes("Phase:"));
    expect(phaseText).toContain("Complete");
  });

  it("shows phase 'Implementation' when subagent failed", () => {
    const details = {
      ...makeResult().details,
      subagentResult: { ...makeResult().details.subagentResult, exitCode: 1 },
    };
    const result = tool.renderResult(
      makeResult({ details }),
      { expanded: true },
      makeTheme(),
      {},
    );
    const texts = result.children.map((c: any) => c.text);
    const phaseText = texts.find((t: string) => t.includes("Phase:"));
    expect(phaseText).toContain("Implementation");
  });

  it("includes merge output when present", () => {
    const details = {
      ...makeResult().details,
      mergeResult: { stdout: "merged successfully", stderr: "", exitCode: 0 },
    };
    const result = tool.renderResult(
      makeResult({ details }),
      { expanded: true },
      makeTheme(),
      {},
    );
    const texts = result.children.map((c: any) => c.text).filter(Boolean);
    const mergeText = texts.find((t: string) =>
      t.includes("merged successfully"),
    );
    expect(mergeText).toBeDefined();
  });
});
