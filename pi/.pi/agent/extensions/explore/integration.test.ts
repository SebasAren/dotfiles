import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock, piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("@sinclair/typebox", typeboxMock);

// Now import the extension after mocks are set up
import exploreExtension from "./index";

describe("explore extension", () => {
  it("can be loaded without errors", () => {
    // Mock ExtensionAPI
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    // Should not throw
    expect(() => exploreExtension(mockApi as any)).not.toThrow();
  });

  it("registers a tool named 'explore'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => {
        registeredTools.push(tool);
      },
      registerCommand: mock(() => {}),
    };
    exploreExtension(mockApi as any);
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("explore");
  });

  it("registers a command named 'explore'", () => {
    const registeredCommands: { name: string; command: any }[] = [];
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: (name: string, command: any) => {
        registeredCommands.push({ name, command });
      },
    };
    exploreExtension(mockApi as any);
    expect(registeredCommands).toHaveLength(1);
    expect(registeredCommands[0].name).toBe("explore");
    expect(registeredCommands[0].command.description).toBeDefined();
  });

  it("declares @pi-ext/shared as a workspace dependency", async () => {
    const pkg = await import("./package.json");
    expect(pkg.dependencies["@pi-ext/shared"]).toBe("workspace:*");
  });
});
