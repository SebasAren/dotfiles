import { describe, it, expect, mock } from "bun:test";
import { piTuiMock } from "../shared/src/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@earendil-works/pi-tui", piTuiMock);

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
  const eventHandlers: Record<string, Function> = {};

  return {
    commands,
    shortcuts,
    flags,
    activeTools,
    eventHandlers,
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
      sendUserMessage: mock(() => {}),
      on: mock((event: string, handler: Function) => {
        eventHandlers[event] = handler;
      }),
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

  describe("/plan command handler notifications", () => {
    it("sends notification when enabling plan mode", async () => {
      const { api, commands } = createMockApi();
      planModeExtension(api);

      const planCmd = commands.find((c) => c.name === "plan")!;
      const notifyMock = mock(() => {});
      const setStatusMock = mock(() => {});
      const mockCtx = {
        ui: {
          notify: notifyMock,
          setStatus: setStatusMock,
          theme: { fg: (_c: string, t: string) => t },
        },
      };

      await planCmd.def.handler([], mockCtx);

      expect(notifyMock).toHaveBeenCalledWith("Plan mode enabled. Read-only tools only.");
      expect(setStatusMock).toHaveBeenCalledWith("plan-mode", "⏸ plan");
    });

    it("sends notification when disabling plan mode", async () => {
      const { api, commands } = createMockApi();
      planModeExtension(api);

      const planCmd = commands.find((c) => c.name === "plan")!;
      const notifyMock = mock(() => {});
      const setStatusMock = mock(() => {});
      const mockCtx = {
        ui: {
          notify: notifyMock,
          setStatus: setStatusMock,
          theme: { fg: (_c: string, t: string) => t },
        },
      };

      // Toggle on first
      await planCmd.def.handler([], mockCtx);
      // Then toggle off
      await planCmd.def.handler([], mockCtx);

      expect(notifyMock).toHaveBeenCalledWith("Plan mode disabled. Full access restored.");
      expect(setStatusMock).toHaveBeenCalledWith("plan-mode", undefined);
    });
  });

  describe("shortcut handler", () => {
    it("toggles plan mode when Ctrl+Alt+P is pressed", async () => {
      const { api, shortcuts } = createMockApi();
      planModeExtension(api);

      const shortcut = shortcuts.find((s) => s.key === "ctrl-alt-p")!;
      const mockCtx = {
        ui: {
          notify: mock(() => {}),
          setStatus: mock(() => {}),
          theme: { fg: (_c: string, t: string) => t },
        },
      };

      await shortcut.def.handler(mockCtx);

      expect(api.setActiveTools).toHaveBeenCalledWith([
        "read",
        "bash",
        "grep",
        "find",
        "ls",
        "explore",
        "librarian",
      ]);
    });
  });

  describe("before_agent_start event handler", () => {
    it("returns undefined when plan mode is disabled", async () => {
      const { api, eventHandlers } = createMockApi();
      planModeExtension(api);

      const handler = eventHandlers["before_agent_start"];
      const result = await handler({});

      expect(result).toBeUndefined();
    });

    it("returns plan mode message when plan mode is enabled via toggle", async () => {
      const { api, commands, eventHandlers } = createMockApi();
      planModeExtension(api);

      // First enable plan mode via /plan command
      const planCmd = commands.find((c) => c.name === "plan")!;
      await planCmd.def.handler([], {
        ui: {
          notify: mock(() => {}),
          setStatus: mock(() => {}),
          theme: { fg: (_c: string, t: string) => t },
        },
      });

      const handler = eventHandlers["before_agent_start"];
      const result = await handler({});

      expect(result).toBeDefined();
      expect(result!.message.content).toContain("PLAN MODE ACTIVE");
      expect(result!.message.display).toBe(false);
    });
  });

  describe("session_start event handler", () => {
    it("enables plan mode when --plan flag is set", async () => {
      const { api, eventHandlers } = createMockApi();
      api.getFlag = mock((name: string) => {
        if (name === "plan") return true;
        return false;
      });
      planModeExtension(api);

      const handler = eventHandlers["session_start"];
      const statusMock = mock(() => {});
      await handler(
        {},
        {
          ui: {
            setStatus: statusMock,
            theme: { fg: (_c: string, t: string) => t },
          },
        },
      );

      expect(api.setActiveTools).toHaveBeenCalledWith([
        "read",
        "bash",
        "grep",
        "find",
        "ls",
        "explore",
        "librarian",
      ]);
      expect(statusMock).toHaveBeenCalledWith("plan-mode", "⏸ plan");
    });

    it("does not enable plan mode when --plan flag is not set", async () => {
      const { api, eventHandlers } = createMockApi();
      planModeExtension(api);

      const handler = eventHandlers["session_start"];
      const toolsSpy = mock(() => {});
      api.setActiveTools = toolsSpy;

      await handler(
        {},
        {
          ui: {
            setStatus: mock(() => {}),
            theme: { fg: (_c: string, t: string) => t },
          },
        },
      );

      expect(toolsSpy).not.toHaveBeenCalled();
    });
  });

  describe("/plan-execute command handler onComplete", () => {
    it("sends steer message after compaction completes", async () => {
      const { api, commands } = createMockApi();
      planModeExtension(api);

      const execCmd = commands.find((c) => c.name === "plan-execute")!;
      let onCompleteCallback: (() => void) | undefined;
      const compactMock = mock((opts: { onComplete: () => void }) => {
        onCompleteCallback = opts.onComplete;
      });

      await execCmd.def.handler([], {
        ui: {
          notify: mock(() => {}),
          setStatus: mock(() => {}),
        },
        compact: compactMock,
      });

      expect(onCompleteCallback).toBeDefined();
      onCompleteCallback!();

      expect(api.sendUserMessage).toHaveBeenCalledWith(
        expect.stringContaining("I have a plan I want to execute"),
        { deliverAs: "steer" },
      );
    });
  });
});
