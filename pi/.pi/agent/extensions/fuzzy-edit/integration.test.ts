import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock, typeboxMock } from "../shared/src/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@sinclair/typebox", typeboxMock);

import fuzzyEditExtension from "./index";

describe("fuzzy-edit extension", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      registerTool: mock(() => {}),
    };
    expect(() => fuzzyEditExtension(mockApi as any)).not.toThrow();
  });

  it("registers a tool named 'edit'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    fuzzyEditExtension(mockApi as any);
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("edit");
  });

  it("has prepareArguments function", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    fuzzyEditExtension(mockApi as any);
    expect(typeof registeredTools[0].prepareArguments).toBe("function");
  });
});
