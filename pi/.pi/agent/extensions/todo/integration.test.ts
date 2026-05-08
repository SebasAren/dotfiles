/**
 * Integration tests for the todo extension.
 *
 * Verifies that the extension loads correctly, registers the expected
 * tool and command, and the execute handler returns correct result shapes.
 */

import { describe, it, expect, mock } from "bun:test";
import { piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-tui", () => ({
  ...piTuiMock(),
  matchesKey: (_data: string, _key: string) => false,
  truncateToWidth: (text: string, _width: number) => text,
}));
mock.module("@mariozechner/pi-ai", () => ({
  StringEnum: (values: readonly string[]) => ({ type: "string", enum: [...values] }),
}));
mock.module("typebox", typeboxMock);

// Now import the extension after mocks are set up
import todoExtension from "./index";

describe("todo extension integration", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      on: mock(() => {}),
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    expect(() => todoExtension(mockApi as any)).not.toThrow();
  });

  it("registers the todo tool", () => {
    const tools: string[] = [];
    const mockApi = {
      on: mock(() => {}),
      registerTool: mock((def: any) => tools.push(def.name)),
      registerCommand: mock(() => {}),
    };
    todoExtension(mockApi as any);
    expect(tools).toContain("todo");
  });

  it("registers the /todos command", () => {
    const commands: string[] = [];
    const mockApi = {
      on: mock(() => {}),
      registerTool: mock(() => {}),
      registerCommand: mock((name: string) => commands.push(name)),
    };
    todoExtension(mockApi as any);
    expect(commands).toContain("todos");
  });

  it("registers session_start and session_tree event handlers", () => {
    const events: string[] = [];
    const mockApi = {
      on: (event: string) => {
        events.push(event);
      },
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    todoExtension(mockApi as any);
    expect(events).toContain("session_start");
    expect(events).toContain("session_tree");
  });

  describe("execute handler", () => {
    it("adds a todo and returns expected result shape", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      const result = await tool.execute(
        "call-1",
        { action: "add", texts: ["Write integration tests"] },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");
      expect(result.content[0].text).toContain("Added todo #1");
      expect(result.details).toBeDefined();
      expect(result.details.action).toBe("add");
      expect(result.details.todos).toHaveLength(1);
      expect(result.details.todos[0].text).toBe("Write integration tests");
      expect(result.details.todos[0].done).toBe(false);
      expect(result.details.nextId).toBe(2);
    });

    it("lists todos after adding items", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      await tool.execute(
        "call-1",
        { action: "add", texts: ["First item", "Second item"] },
        undefined,
        undefined,
        {} as any,
      );

      const result = await tool.execute(
        "call-2",
        { action: "list" },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.details.action).toBe("list");
      expect(result.details.todos).toHaveLength(2);
      expect(result.content[0].text).toContain("#1");
      expect(result.content[0].text).toContain("#2");
    });

    it("toggles a todo complete status", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      await tool.execute(
        "call-1",
        { action: "add", texts: ["Something to do"] },
        undefined,
        undefined,
        {} as any,
      );

      const result = await tool.execute(
        "call-2",
        { action: "toggle", id: 1 },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.details.action).toBe("toggle");
      expect(result.details.todos[0].done).toBe(true);
      expect(result.content[0].text).toContain("completed");
    });

    it("clears all todos", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      await tool.execute(
        "call-1",
        { action: "add", texts: ["Temp item"] },
        undefined,
        undefined,
        {} as any,
      );

      const result = await tool.execute(
        "call-2",
        { action: "clear" },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.details.action).toBe("clear");
      expect(result.details.todos).toHaveLength(0);
      expect(result.content[0].text).toContain("Cleared");
    });

    it("returns error when toggling without id", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      const result = await tool.execute(
        "call-1",
        { action: "toggle" },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.details.error).toBe("id required");
    });

    it("returns error when adding without texts", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      const result = await tool.execute(
        "call-1",
        { action: "add" },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.details.error).toBe("texts required");
    });

    it("returns error for unknown action", async () => {
      const registeredTools: any[] = [];
      const mockApi = {
        on: mock(() => {}),
        registerTool: mock((def: any) => registeredTools.push(def)),
        registerCommand: mock(() => {}),
      };
      todoExtension(mockApi as any);
      const tool = registeredTools.find((t: any) => t.name === "todo")!;

      const result = await tool.execute(
        "call-1",
        { action: "invalid" },
        undefined,
        undefined,
        {} as any,
      );

      expect(result.details.error).toContain("unknown action");
    });
  });

  it("declares @pi-ext/shared as a workspace dependency", async () => {
    const pkg = await import("./package.json");
    expect(pkg.dependencies?.["@pi-ext/shared"]).toBe("workspace:*");
  });
});
