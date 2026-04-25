import { describe, it, expect, mock } from "bun:test";

// Mock TUI so render tests work without a display and avoid ANSI noise
mock.module("@mariozechner/pi-tui", () => ({
  Text: class Text {
    text: string;
    constructor(text: string, _x: number, _y: number) {
      this.text = text;
    }
    setText(t: string) {
      this.text = t;
    }
  },
}));

import ext from "./index";

// ── Helpers ──────────────────────────────────────────────────────────────────

function createExtension() {
  const tools: Array<{ name: string } & Record<string, any>> = [];
  const commands: Array<{ name: string; def: Record<string, any> }> = [];
  const storedEntries: Array<{ type: string; data?: any }> = [];
  const labels = new Map<string, string>();
  const events = new Map<string, (...args: any[]) => any>();

  const pi = {
    registerTool: (def: any) => tools.push(def),
    registerCommand: (name: string, def: any) => commands.push({ name, def }),
    on: (event: string, handler: any) => events.set(event, handler),
    appendEntry: (type: string, data: any) => storedEntries.push({ type, data }),
    setLabel: (id: string, label: string) => labels.set(id, label),
  };

  ext(pi as any);

  function makeCtx(
    opts: {
      leafId?: string;
      entries?: Array<{ id: string; type: string; customType?: string; label?: string }>;
      navigateTree?: (targetId: string, options: any) => Promise<{ cancelled: boolean }>;
    } = {},
  ) {
    const notifications: Array<{ message: string; level: string }> = [];
    const labelMap = new Map(labels);
    for (const e of opts.entries ?? []) {
      if (e.label) labelMap.set(e.id, e.label);
    }
    return {
      sessionManager: {
        getLeafId: () => opts.leafId ?? undefined,
        getEntries: () => opts.entries ?? [],
        getLabel: (id: string) => labelMap.get(id),
      },
      ui: {
        notify: (message: string, level: string) => {
          notifications.push({ message, level });
        },
      },
      navigateTree: opts.navigateTree ?? (async () => ({ cancelled: false })),
      notifications,
    };
  }

  return { tools, commands, storedEntries, labels, events, makeCtx };
}

function makeTheme() {
  return {
    fg: (_color: string, text: string) => text,
    bg: () => "",
    bold: (text: string) => text,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("tdd-tree extension", () => {
  it("registers tdd-set-kickoff tool and both commands", () => {
    const { tools, commands } = createExtension();
    expect(tools.some((t) => t.name === "tdd-set-kickoff")).toBe(true);
    expect(commands.some((c) => c.name === "tdd-go-kickoff")).toBe(true);
    expect(commands.some((c) => c.name === "kickoff")).toBe(true);
  });

  describe("tdd-set-kickoff tool", () => {
    it("refuses when no leaf exists", async () => {
      const { tools, makeCtx } = createExtension();
      const tool = tools.find((t) => t.name === "tdd-set-kickoff")!;
      const ctx = makeCtx();
      const result = await tool.execute("id", { slug: "plan" }, undefined, () => {}, ctx);
      expect(result.details?.success).toBe(false);
      expect(result.content[0].text).toContain("No session content yet");
    });

    it("refuses duplicate and mentions /kickoff", async () => {
      const { tools, events, makeCtx } = createExtension();
      const tool = tools.find((t) => t.name === "tdd-set-kickoff")!;
      const entries = [
        {
          id: "leaf-1",
          type: "custom",
          customType: "tdd-kickoff",
          data: { slug: "plan", entryId: "leaf-1" },
        },
      ] as const;
      const ctx = makeCtx({ leafId: "leaf-2", entries });
      await events.get("session_start")?.({}, ctx);

      const result = await tool.execute("id", { slug: "plan" }, undefined, () => {}, ctx);
      expect(result.details?.success).toBe(false);
      expect(result.content[0].text).toContain("already exists");
      expect(result.content[0].text).toContain("/kickoff");
    });

    it("sets kickoff and mentions /kickoff on success", async () => {
      const { tools, labels, storedEntries, makeCtx } = createExtension();
      const tool = tools.find((t) => t.name === "tdd-set-kickoff")!;
      const ctx = makeCtx({ leafId: "leaf-2" });
      const result = await tool.execute("id", { slug: "plan" }, undefined, () => {}, ctx);
      expect(result.details?.success).not.toBe(false);
      expect(result.content[0].text).toContain("/kickoff");
      expect(labels.get("leaf-2")).toBe("tdd-kickoff-plan");
      expect(storedEntries).toHaveLength(1);
      expect(storedEntries[0].data.slug).toBe("plan");
    });

    it("renderCall produces text component", () => {
      const { tools } = createExtension();
      const tool = tools.find((t) => t.name === "tdd-set-kickoff")!;
      const result = tool.renderCall({ slug: "auth" }, makeTheme(), {});
      expect(result.text).toContain("auth");
    });

    it("renderResult reuses context.lastComponent", () => {
      const { tools } = createExtension();
      const tool = tools.find((t) => t.name === "tdd-set-kickoff")!;
      const existing = { setText: mock(() => {}) };
      const result = tool.renderResult(
        { content: [], details: { success: true, slug: "auth" } },
        {},
        makeTheme(),
        { lastComponent: existing as any },
      );
      expect(result).toBe(existing);
      expect(existing.setText).toHaveBeenCalledWith('✅ Kickoff set for "auth"');
    });

    it("renderResult shows error for failed kickoff", () => {
      const { tools } = createExtension();
      const tool = tools.find((t) => t.name === "tdd-set-kickoff")!;
      const result = tool.renderResult(
        { content: [], details: { success: false } },
        {},
        makeTheme(),
        {},
      );
      expect(result.text).toContain("❌");
    });
  });

  describe("/tdd-go-kickoff command", () => {
    it("shows usage without args", async () => {
      const { commands, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "tdd-go-kickoff")!.def;
      const ctx = makeCtx();
      await cmd.handler("", ctx);
      expect(ctx.notifications).toContainEqual({
        message: "Usage: /tdd-go-kickoff <slug>",
        level: "info",
      });
    });

    it("navigates to labeled entry when not in cache", async () => {
      const { commands, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "tdd-go-kickoff")!.def;
      const navigateTree = mock(() => Promise.resolve({ cancelled: false }));
      const ctx = makeCtx({
        leafId: "current",
        entries: [{ id: "target", type: "custom", label: "tdd-kickoff-plan" }],
        navigateTree,
      });
      await cmd.handler("plan", ctx);
      expect(navigateTree).toHaveBeenCalledWith(
        "target",
        expect.objectContaining({ summarize: true }),
      );
    });

    it("short-circuits when already at kickoff", async () => {
      const { commands, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "tdd-go-kickoff")!.def;
      const navigateTree = mock(() => Promise.resolve({ cancelled: false }));
      const ctx = makeCtx({
        leafId: "target",
        entries: [{ id: "target", type: "custom", label: "tdd-kickoff-plan" }],
        navigateTree,
      });
      await cmd.handler("plan", ctx);
      expect(navigateTree).not.toHaveBeenCalled();
      expect(ctx.notifications).toContainEqual({
        message: "Already at the kickoff point.",
        level: "info",
      });
    });

    it("falls back to label scan when cached entry is stale", async () => {
      const { commands, events, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "tdd-go-kickoff")!.def;

      // Populate cache via session_start
      const entries = [
        {
          id: "old-target",
          type: "custom",
          customType: "tdd-kickoff",
          data: { slug: "plan", entryId: "old-target" },
        },
      ] as const;
      await events.get("session_start")?.({}, makeCtx({ entries }));

      // Now call command with empty session (stale cache) and no matching label
      const ctx = makeCtx({ leafId: "current", entries: [] });
      await cmd.handler("plan", ctx);
      expect(ctx.notifications).toContainEqual({
        message: expect.stringContaining("No kickoff point found"),
        level: "error",
      });
    });

    it("reports error when no kickoff is found", async () => {
      const { commands, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "tdd-go-kickoff")!.def;
      const ctx = makeCtx({ leafId: "current" });
      await cmd.handler("missing", ctx);
      expect(ctx.notifications).toContainEqual({
        message: expect.stringContaining("No kickoff point found"),
        level: "error",
      });
    });
  });

  describe("/kickoff command", () => {
    it("uses activeSlug when no argument given", async () => {
      const { commands, events, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "kickoff")!.def;

      const entries = [
        {
          id: "target",
          type: "custom",
          customType: "tdd-kickoff",
          data: { slug: "plan", entryId: "target" },
        },
      ] as const;
      await events.get("session_start")?.({}, makeCtx({ entries }));

      const navigateTree = mock(() => Promise.resolve({ cancelled: false }));
      const ctx = makeCtx({ leafId: "current", entries, navigateTree });
      await cmd.handler("", ctx);
      expect(navigateTree).toHaveBeenCalledWith("target", expect.anything());
    });

    it("navigates with explicit slug", async () => {
      const { commands, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "kickoff")!.def;
      const navigateTree = mock(() => Promise.resolve({ cancelled: false }));
      const ctx = makeCtx({
        leafId: "current",
        entries: [{ id: "target", type: "custom", label: "tdd-kickoff-plan" }],
        navigateTree,
      });
      await cmd.handler("plan", ctx);
      expect(navigateTree).toHaveBeenCalledWith("target", expect.anything());
    });

    it("errors when no activeSlug and no entries", async () => {
      const { commands, makeCtx } = createExtension();
      const cmd = commands.find((c) => c.name === "kickoff")!.def;
      const ctx = makeCtx();
      await cmd.handler("", ctx);
      expect(ctx.notifications).toContainEqual({
        message: expect.stringContaining("No kickoff points found"),
        level: "error",
      });
    });
  });
});
