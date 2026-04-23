import { describe, it, expect, mock, beforeEach } from "bun:test";
import { piCodingAgentMock, piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("typebox", typeboxMock);

// Now import the extension after mocks are set up
import librarianExtension from "./index";

describe("librarian extension", () => {
  beforeEach(() => {
    delete process.env.PI_LIBRARIAN_CHILD;
  });

  it("can be loaded without errors", () => {
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    expect(() => librarianExtension(mockApi as any)).not.toThrow();
  });

  it("registers a tool named 'librarian'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => {
        registeredTools.push(tool);
      },
      registerCommand: mock(() => {}),
    };
    librarianExtension(mockApi as any);
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("librarian");
  });

  it("registers a command named 'librarian'", () => {
    const registeredCommands: { name: string; command: any }[] = [];
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: (name: string, command: any) => {
        registeredCommands.push({ name, command });
      },
    };
    librarianExtension(mockApi as any);
    expect(registeredCommands).toHaveLength(1);
    expect(registeredCommands[0].name).toBe("librarian");
    expect(registeredCommands[0].command.description).toBeDefined();
  });

  it("no longer needs child process guard (in-process SDK)", () => {
    // Previously: the librarian subprocess would skip registration via PI_LIBRARIAN_CHILD env var.
    // Now: the librarian runs in-process via the pi SDK, so no guard is needed.
    // The extension always registers when loaded.
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    librarianExtension(mockApi as any);
    expect(mockApi.registerTool).toHaveBeenCalled();
  });

  it("declares @pi-ext/shared as a workspace dependency", async () => {
    const pkg = await import("./package.json");
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies["@pi-ext/shared"]).toBe("workspace:*");
  });
});
