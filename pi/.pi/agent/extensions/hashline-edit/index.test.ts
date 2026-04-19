import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock, typeboxMock } from "../shared/src/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@sinclair/typebox", typeboxMock);

import hashlineEditExtension from "./index";

describe("hashline-edit extension", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      registerTool: mock(() => {}),
    };
    expect(() => hashlineEditExtension(mockApi as any)).not.toThrow();
  });

  it("registers two tools: 'read' and 'edit'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    hashlineEditExtension(mockApi as any);
    expect(registeredTools).toHaveLength(2);
    expect(registeredTools[0].name).toBe("read");
    expect(registeredTools[1].name).toBe("edit");
  });

  it("has prepareArguments on the edit tool", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    hashlineEditExtension(mockApi as any);
    const editTool = registeredTools.find((t: any) => t.name === "edit");
    expect(typeof editTool.prepareArguments).toBe("function");
  });

  it("has promptGuidelines on both tools", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    hashlineEditExtension(mockApi as any);
    for (const tool of registeredTools) {
      expect(Array.isArray(tool.promptGuidelines)).toBe(true);
      expect(tool.promptGuidelines.length).toBeGreaterThan(0);
    }
  });
});
