import { describe, it, expect, mock, beforeEach } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

/**
 * Integration tests for session-analyzer extension
 */
describe("session-analyzer", () => {
  let mockPi: ExtensionAPI;
  let _mockCtx: ExtensionContext;

  beforeEach(() => {
    // Mock ExtensionAPI
    mockPi = {
      on: mock(() => {}),
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
      sendMessage: mock(() => {}),
      sendUserMessage: mock(() => {}),
      appendEntry: mock(() => {}),
      setSessionName: mock(() => {}),
      getSessionName: mock(() => ""),
      setLabel: mock(() => {}),
      getCommands: mock(() => []),
      registerMessageRenderer: mock(() => {}),
      registerShortcut: mock(() => {}),
      registerFlag: mock(() => {}),
      exec: mock(() => Promise.resolve({ stdout: "", stderr: "", code: 0, killed: false })),
      getActiveTools: mock(() => []),
      getAllTools: mock(() => []),
      setActiveTools: mock(() => {}),
      setModel: mock(() => Promise.resolve(true)),
      getThinkingLevel: mock(() => "off"),
      setThinkingLevel: mock(() => {}),
      events: { on: mock(() => {}), emit: mock(() => {}) },
      registerProvider: mock(() => {}),
      unregisterProvider: mock(() => {}),
    } as unknown as ExtensionAPI;

    // Mock ExtensionContext
    _mockCtx = {
      cwd: "/test",
      hasUI: true,
      ui: {
        notify: mock(() => {}),
        confirm: mock(() => Promise.resolve(true)),
        select: mock(() => Promise.resolve("option")),
        input: mock(() => Promise.resolve("input")),
        editor: mock(() => Promise.resolve("text")),
        custom: mock(() => Promise.resolve(undefined)),
        setStatus: mock(() => {}),
        setWidget: mock(() => {}),
        setFooter: mock(() => {}),
        setTitle: mock(() => {}),
        setEditorText: mock(() => {}),
        getEditorText: mock(() => ""),
        pasteToEditor: mock(() => {}),
        getToolsExpanded: mock(() => true),
        setToolsExpanded: mock(() => {}),
        setEditorComponent: mock(() => {}),
        getAllThemes: mock(() => []),
        getTheme: mock(() => null),
        setTheme: mock(() => ({ success: true })),
        theme: {
          fg: (_color: string, text: string) => text,
          bold: (text: string) => text,
          italic: (text: string) => text,
          strikethrough: (text: string) => text,
        },
        setWorkingMessage: mock(() => {}),
      },
      sessionManager: {
        getEntries: mock(() => []),
        getBranch: mock(() => []),
        getLeafId: mock(() => "test-id"),
        getSessionFile: mock(() => "/test/session.jsonl"),
        getHeader: mock(() => ({
          type: "session",
          id: "test-session",
          timestamp: new Date().toISOString(),
          cwd: "/test",
        })),
      },
      modelRegistry: {} as any,
      model: undefined,
      signal: undefined,
      isIdle: mock(() => true),
      abort: mock(() => {}),
      hasPendingMessages: mock(() => false),
      shutdown: mock(() => {}),
      getContextUsage: mock(() => undefined),
      compact: mock(() => {}),
      getSystemPrompt: mock(() => ""),
    } as unknown as ExtensionContext;
  });

  it("extension loads without errors", async () => {
    // Import the extension
    const extension = await import("./index");
    expect(extension.default).toBeTypeOf("function");
  });

  it("extension registers commands", async () => {
    const { default: extensionFn } = await import("./index");
    extensionFn(mockPi);

    // Verify commands were registered
    const commandCalls = (mockPi.registerCommand as ReturnType<typeof mock>).mock.calls;
    const commandNames = commandCalls.map((call: any) => call[0]);

    expect(commandNames).toContain("export-session");
    expect(commandNames).toContain("analyze-session");
  });

  it("extension registers tool", async () => {
    const { default: extensionFn } = await import("./index");
    extensionFn(mockPi);

    // Verify tool was registered
    const toolCalls = (mockPi.registerTool as ReturnType<typeof mock>).mock.calls;
    const toolNames = toolCalls.map((call: any) => call[0].name);

    expect(toolNames).toContain("session_analyze");
  });

  it("tool has correct parameters", async () => {
    const { default: extensionFn } = await import("./index");
    extensionFn(mockPi);

    // Find the tool registration
    const toolCalls = (mockPi.registerTool as ReturnType<typeof mock>).mock.calls;
    const sessionAnalyzeTool = toolCalls.find((call: any) => call[0].name === "session_analyze");

    expect(sessionAnalyzeTool).toBeDefined();
    expect(sessionAnalyzeTool[0].parameters).toBeDefined();
    expect(sessionAnalyzeTool[0].execute).toBeTypeOf("function");
  });
});

describe("analyzer", () => {
  it("analyzeSession returns valid structure", async () => {
    const { analyzeSession } = await import("./analyzer");

    const result = analyzeSession([], {
      includeThinking: true,
      includeToolResults: true,
      includeToolResultContent: true,
      maxToolResultLength: 500,
      analyzeIssues: true,
    });

    expect(result.meta).toBeDefined();
    expect(result.turns).toEqual([]);
    expect(result.toolExecutions).toEqual([]);
    expect(result.issues).toEqual([]);
    expect(result.summary).toBeDefined();
    expect(result.summary.totalToolCalls).toBe(0);
    expect(result.summary.errorCount).toBe(0);
  });

  it("analyzeSession processes user messages", async () => {
    const { analyzeSession } = await import("./analyzer");

    const entries = [
      { type: "session", id: "test", timestamp: "2024-01-01T00:00:00Z", cwd: "/test" },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:01Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Hello" }],
          timestamp: Date.now(),
        },
      },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:02Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hi there!" }],
          provider: "test",
          model: "test-model",
          usage: { input: 10, output: 5, totalTokens: 15 },
          timestamp: Date.now(),
        },
      },
    ];

    const result = analyzeSession(entries as any, {
      includeThinking: true,
      includeToolResults: true,
      includeToolResultContent: true,
      maxToolResultLength: 500,
      analyzeIssues: true,
    });

    expect(result.meta.turnCount).toBe(1);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].userMessage).toBe("Hello");
    expect(result.turns[0].assistantText).toBe("Hi there!");
  });

  it("analyzeSession detects repeated commands", async () => {
    const { analyzeSession } = await import("./analyzer");

    const entries = [
      { type: "session", id: "test", timestamp: "2024-01-01T00:00:00Z", cwd: "/test" },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:01Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Run ls" }],
          timestamp: Date.now(),
        },
      },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:02Z",
        message: {
          role: "assistant",
          content: [
            { type: "toolCall", id: "t1", name: "bash", arguments: { command: "ls" } },
            { type: "toolCall", id: "t2", name: "bash", arguments: { command: "ls" } },
            { type: "toolCall", id: "t3", name: "bash", arguments: { command: "ls" } },
          ],
          provider: "test",
          model: "test",
          timestamp: Date.now(),
        },
      },
    ];

    const result = analyzeSession(entries as any, {
      includeThinking: true,
      includeToolResults: true,
      includeToolResultContent: true,
      maxToolResultLength: 500,
      analyzeIssues: true,
    });

    expect(result.summary.toolCallCounts.bash).toBe(3);
    // Repeated commands require the same command across multiple tool calls
    expect(result.issues.some((i) => i.type === "repeated_command")).toBe(true);
  });

  it("analyzeSession detects inefficient patterns", async () => {
    const { analyzeSession } = await import("./analyzer");

    const entries = [
      { type: "session", id: "test", timestamp: "2024-01-01T00:00:00Z", cwd: "/test" },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:01Z",
        message: {
          role: "user",
          content: [{ type: "text", text: "Read file" }],
          timestamp: Date.now(),
        },
      },
      {
        type: "message",
        timestamp: "2024-01-01T00:00:02Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "t1",
              name: "bash",
              arguments: { command: "cat /test/file.txt" },
            },
            {
              type: "toolCall",
              id: "t2",
              name: "bash",
              arguments: { command: "grep pattern /test/file.txt" },
            },
          ],
          provider: "test",
          model: "test",
          timestamp: Date.now(),
        },
      },
    ];

    const result = analyzeSession(entries as any, {
      includeThinking: true,
      includeToolResults: true,
      includeToolResultContent: true,
      maxToolResultLength: 500,
      analyzeIssues: true,
    });

    expect(result.issues.some((i) => i.type === "inefficient_tool")).toBe(true);
  });
});
