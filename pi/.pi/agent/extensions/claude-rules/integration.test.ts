import { describe, it, expect, mock } from "bun:test";

// Mock picomatch
mock.module("picomatch", () => () => () => true);

import claudeRulesExtension from "./index";

describe("claude-rules extension", () => {
  it("can be loaded without errors", () => {
    const handlers: Record<string, Function[]> = {};
    const mockApi = {
      on: (event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      },
      registerTool: () => {},
    };
    expect(() => claudeRulesExtension(mockApi as any)).not.toThrow();
  });

  it("registers session_start, before_agent_start, tool_result, session_compact, and session_tree handlers", () => {
    const handlers: Record<string, Function[]> = {};
    const mockApi = {
      on: (event: string, handler: Function) => {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(handler);
      },
      registerTool: () => {},
    };
    claudeRulesExtension(mockApi as any);
    expect(handlers["session_start"]).toHaveLength(1);
    expect(handlers["before_agent_start"]).toHaveLength(1);
    expect(handlers["tool_result"]).toHaveLength(1);
    expect(handlers["session_compact"]).toHaveLength(1);
    expect(handlers["session_tree"]).toHaveLength(1);
  });
});
