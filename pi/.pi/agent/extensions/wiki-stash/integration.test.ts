/**
 * Integration tests for the wiki-stash extension.
 *
 * Verifies that the extension loads correctly, registers the expected
 * /stash command, and the command handler handles empty args gracefully.
 */

import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@earendil-works/pi-coding-agent", () => ({
  ...piCodingAgentMock(),
  AuthStorage: class AuthStorage {
    static create() {
      return new AuthStorage();
    }
    getKey() {
      return undefined;
    }
    setKey() {}
  },
  ModelRegistry: class ModelRegistry {
    static create(_authStorage: any) {
      return new ModelRegistry();
    }
    find() {
      return undefined;
    }
    getAll() {
      return [];
    }
  },
  SettingsManager: class SettingsManager {
    static inMemory(_opts?: any) {
      return new SettingsManager();
    }
  },
  BorderedLoader: class BorderedLoader {
    onAbort: (() => void) | undefined;
    constructor(_tui: any, _theme: any, _message: string) {}
  },
  SessionManager: class SessionManager {
    static inMemory() {
      return new SessionManager();
    }
  },
  DefaultResourceLoader: class DefaultResourceLoader {
    constructor(_opts: any) {}
    async reload() {}
    async loadExtensions() {
      return [];
    }
    async loadTools() {
      return [];
    }
  },
}));
mock.module("@pi-ext/shared", () => ({
  resolveRealCwd: (_cwd: string) => _cwd,
  runSubagent: mock(() => Promise.resolve({ exitCode: 0, output: "Stashed new note", stderr: "" })),
}));
mock.module("./constants", () => ({
  STASH_SYSTEM_PROMPT: "Mock system prompt for testing",
}));

// Now import the extension after mocks are set up
import stashExtension from "./index";

describe("wiki-stash extension integration", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      registerCommand: mock(() => {}),
    };
    expect(() => stashExtension(mockApi as any)).not.toThrow();
  });

  it("registers the /stash command", () => {
    const commands: string[] = [];
    const mockApi = {
      registerCommand: mock((name: string) => {
        commands.push(name);
      }),
    };
    stashExtension(mockApi as any);
    expect(commands).toContain("stash");
  });

  it("registers the /stash command with correct description", () => {
    const defs: Array<{ name: string; def: any }> = [];
    const mockApi = {
      registerCommand: mock((name: string, def: any) => {
        defs.push({ name, def });
      }),
    };
    stashExtension(mockApi as any);
    const stashCmd = defs.find((d) => d.name === "stash")!;
    expect(stashCmd).toBeDefined();
    expect(stashCmd.def.description).toContain("Persist knowledge to wiki");
  });

  it("shows usage hint when no args provided", async () => {
    const defs: Array<{ name: string; def: any }> = [];
    const mockApi = {
      registerCommand: mock((name: string, def: any) => {
        defs.push({ name, def });
      }),
    };
    stashExtension(mockApi as any);
    const stashCmd = defs.find((d) => d.name === "stash")!;

    const notifyMock = mock(() => {});
    await stashCmd.def.handler("", {
      ui: { notify: notifyMock },
      model: { provider: "openai", id: "gpt-4" },
      cwd: "/tmp",
    } as any);

    expect(notifyMock).toHaveBeenCalledWith("Usage: /stash <knowledge to persist>", "info");
  });

  it("declares @pi-ext/shared as a workspace dependency", async () => {
    const pkg = await import("./package.json");
    expect(pkg.dependencies?.["@pi-ext/shared"]).toBe("workspace:*");
  });
});
