import { describe, it, expect, mock } from "bun:test";
import { piTuiMock } from "../shared/src/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-tui", piTuiMock);

// Now import the extension after mocks are set up
import planModeExtension from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RegisteredCommand = {
  name: string;
  def: { description: string; handler: (args: string[], ctx: any) => Promise<void> };
};

type RegisteredShortcut = {
  key: string;
  def: { description: string; handler: (ctx: any) => Promise<void> };
};

function createMockApi() {
  const commands: RegisteredCommand[] = [];
  const shortcuts: RegisteredShortcut[] = [];
  const flags: { name: string; def: any }[] = [];
  let activeTools: string[] | undefined;

  return {
    commands,
    shortcuts,
    flags,
    activeTools,
    api: {
      registerCommand: mock((name: string, def: any) => {
        commands.push({ name, def });
      }),
      registerShortcut: mock((key: string, def: any) => {
        shortcuts.push({ key, def });
      }),
      registerFlag: mock((name: string, def: any) => {
        flags.push({ name, def });
      }),
      setActiveTools: mock((tools: string[]) => {
        activeTools = tools;
      }),
      on: mock(() => {}),
      getFlag: mock(() => false),
    } as any,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("plan mode extension", () => {
  it("can be loaded without errors", () => {
    const { api } = createMockApi();
    expect(() => planModeExtension(api)).not.toThrow();
  });

  it("registers /plan and /plan-execute commands", () => {
    const { api, commands } = createMockApi();
    planModeExtension(api);
    expect(commands).toHaveLength(2);
    expect(commands.some((c) => c.name === "plan")).toBe(true);
    expect(commands.some((c) => c.name === "plan-execute")).toBe(true);
  });

  it("registers Ctrl+Alt+P shortcut", () => {
    const { api, shortcuts } = createMockApi();
    planModeExtension(api);
    expect(shortcuts).toHaveLength(1);
    expect(shortcuts[0].key).toBe("ctrl-alt-p");
    expect(shortcuts[0].def.description).toContain("Toggle plan mode");
  });

  it("registers plan flag", () => {
    const { api, flags } = createMockApi();
    planModeExtension(api);
    expect(flags).toHaveLength(1);
    expect(flags[0].name).toBe("plan");
    expect(flags[0].def.type).toBe("boolean");
    expect(flags[0].def.default).toBe(false);
  });

  it("registers before_agent_start and session_start event handlers", () => {
    const { api } = createMockApi();
    planModeExtension(api);
    expect(api.on).toHaveBeenCalledTimes(2);
    const eventNames = api.on.mock.calls.map((call: any[]) => call[0]);
    expect(eventNames).toContain("before_agent_start");
    expect(eventNames).toContain("session_start");
  });

  describe("/plan command handler", () => {
    it("enables plan mode on first toggle", async () => {
      const { api, commands } = createMockApi();
      planModeExtension(api);

      const planCmd = commands.find((c) => c.name === "plan")!;
      const mockCtx = {
        ui: {
          notify: mock(() => {}),
          setStatus: mock(() => {}),
          theme: { fg: mock((_: string, t: string) => t) },
        },
      };

      await planCmd.def.handler([], mockCtx);

      expect(api.setActiveTools).toHaveBeenCalledWith([
        "read",
        "bash",
        "grep",
        "find",
        "ls",
        "questionnaire",
        "explore",
        "librarian",
      ]);
    });

    it("restores full tools on second toggle", async () => {
      const { api, commands } = createMockApi();
      planModeExtension(api);

      const planCmd = commands.find((c) => c.name === "plan")!;
      const mockCtx = {
        ui: {
          notify: mock(() => {}),
          setStatus: mock(() => {}),
          theme: { fg: mock((_: string, t: string) => t) },
        },
      };

      // Toggle on
      await planCmd.def.handler([], mockCtx);
      // Toggle off
      await planCmd.def.handler([], mockCtx);

      expect(api.setActiveTools).toHaveBeenLastCalledWith(["read", "bash", "edit", "write"]);
    });
  });

  describe("/plan-execute command handler", () => {
    it("disables plan mode and triggers compaction", async () => {
      const { api, commands } = createMockApi();
      planModeExtension(api);

      const execCmd = commands.find((c) => c.name === "plan-execute")!;
      const mockCtx = {
        ui: {
          notify: mock(() => {}),
          setStatus: mock(() => {}),
        },
        compact: mock(() => {}),
      };

      await execCmd.def.handler([], mockCtx);

      expect(api.setActiveTools).toHaveBeenCalledWith(["read", "bash", "edit", "write"]);
      expect(mockCtx.compact).toHaveBeenCalled();
    });
  });
});
