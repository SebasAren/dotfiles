/**
 * Tests for librarian tracing integration — verifies that execute() correctly
 * wires startSubagentTrace and onToolCall child spans.
 *
 * Uses mock.module to control @pi-ext/shared and local modules so we can
 * assert on the tracing call chain without actually running a subagent.
 */

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { piCodingAgentMock, piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";

// ── Mock factories ─────────────────────────────────────────────────────────

const mockChild = mock(() => {
  const span = {
    update: mock(() => span),
    end: mock(() => {}),
    startObservation: mock(() => span),
  };
  return span;
});

const mockObservation = {
  update: mock(() => mockObservation as any),
  end: mock(() => {}),
  startObservation: mockChild,
};

const mockStartSubagentTrace = mock(
  (_name: string, _query: string, _cwd: string, _model: string, _sessionId?: string) => ({
    observation: mockObservation,
    child: mockChild,
  }),
);

let capturedRunSubagentOptions: Record<string, unknown> | null = null;

const mockRunSubagent = mock(async (options: any) => {
  capturedRunSubagentOptions = options;
  return {
    exitCode: 0,
    output: "## Documentation\nTest result output.",
    model: "test-model",
    usage: {
      input: 50,
      output: 30,
      turns: 2,
      cost: 0.002,
      contextTokens: 80,
    },
  };
});

// Set up all mocks (order: shared mocks first, then external deps, then local modules)
mock.module("@pi-ext/shared", () => ({
  resolveRealCwd: (cwd: string) => cwd,
  runSubagent: mockRunSubagent,
  getModel: () => "test-model",
  startSubagentTrace: mockStartSubagentTrace,
}));
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("typebox", typeboxMock);

// Import the extension after mocks are set up
import librarianExtension from "./index";

// ── Test helpers ───────────────────────────────────────────────────────────

function setup() {
  const registeredTools: Array<{ name: string; execute: Function }> = [];
  const mockApi = {
    registerTool: (tool: any) => {
      registeredTools.push(tool);
    },
    registerCommand: mock(() => {}),
  };
  librarianExtension(mockApi as any);
  return { execute: registeredTools[0].execute };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("librarian tracing integration", () => {
  beforeEach(() => {
    // Clear all mocks between tests
    mockStartSubagentTrace.mockClear();
    mockChild.mockClear();
    mockObservation.update.mockClear();
    mockObservation.end.mockClear();
    mockRunSubagent.mockClear();
    capturedRunSubagentOptions = null;
  });

  it("calls startSubagentTrace with name 'librarian', query, cwd, and model", async () => {
    const { execute } = setup();

    await execute("call-1", { query: "react hooks docs" }, undefined, undefined, {
      cwd: "/test/repo",
      sessionManager: { getSessionId: () => "test-session-id" },
    });

    expect(mockStartSubagentTrace).toHaveBeenCalledTimes(1);
    expect(mockStartSubagentTrace).toHaveBeenCalledWith(
      "librarian",
      "react hooks docs",
      "/test/repo",
      "test-model",
      "test-session-id",
    );
  });

  it("passes onToolCall to runSubagent that creates child spans", async () => {
    const { execute } = setup();

    await execute("call-1", { query: "react hooks" }, undefined, undefined, {
      cwd: "/test/repo",
      sessionManager: { getSessionId: () => "test-session-id" },
    });

    // runSubagent should have been called with onToolCall
    expect(mockRunSubagent).toHaveBeenCalledTimes(1);
    expect(capturedRunSubagentOptions).not.toBeNull();
    expect(typeof (capturedRunSubagentOptions as any)?.onToolCall).toBe("function");

    // Invoke the captured onToolCall with fake tool data
    const onToolCall = (capturedRunSubagentOptions as any).onToolCall as Function;
    const toolCallChildCount = mockChild.mock.calls.length;

    onToolCall({
      toolName: "web_search",
      argsSummary: "search: react hooks",
      durationMs: 250,
      success: true,
    });

    // A new child span should have been created for this tool call
    expect(mockChild.mock.calls.length).toBeGreaterThan(toolCallChildCount);
    const newCalls = mockChild.mock.calls.slice(toolCallChildCount);
    const toolSpanArg = newCalls.find((c: any) => c[0] === "web_search");
    expect(toolSpanArg).toBeDefined();

    // The returned span should have been ended
    const toolSpanResult = mockChild.mock.results.find((r: any) => r.value && r.value.end);
    expect(toolSpanResult).toBeDefined();
    expect(toolSpanResult.value.end).toHaveBeenCalledTimes(1);
  });

  it("sets output on the root observation and ends it", async () => {
    const { execute } = setup();

    await execute("call-1", { query: "react hooks" }, undefined, undefined, {
      cwd: "/test/repo",
      sessionManager: { getSessionId: () => "test-session-id" },
    });

    // observation.update should have been called with output containing usage stats
    expect(mockObservation.update).toHaveBeenCalled();
    const updateCalls = mockObservation.update.mock.calls;
    const outputCall = updateCalls.find(
      (c: any) => c[0]?.output && typeof c[0].output === "object",
    );
    expect(outputCall).toBeDefined();

    // observation.end should have been called
    expect(mockObservation.end).toHaveBeenCalledTimes(1);
  });

  it("calls startSubagentTrace without sessionId when sessionManager is unavailable", async () => {
    const { execute } = setup();

    await execute("call-1", { query: "react hooks" }, undefined, undefined, {
      cwd: "/test/repo",
    });

    expect(mockStartSubagentTrace).toHaveBeenCalledTimes(1);
    expect(mockStartSubagentTrace).toHaveBeenCalledWith(
      "librarian",
      "react hooks",
      "/test/repo",
      "test-model",
      undefined,
    );
  });
});
