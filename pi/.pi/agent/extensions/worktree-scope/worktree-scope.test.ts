import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Import the extension logic directly
import worktreeScopeExtension from "../worktree-scope/index";

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Create a minimal mock ExtensionAPI that records events and calls.
 */
function createMockPi() {
  const handlers: Record<string, Function[]> = {};
  const notifications: Array<{ message: string; type: string }> = [];
  const pi = {
    on(event: string, handler: Function) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    },
    registerTool: () => {},
    getHandlers: () => handlers,
    getNotifications: () => notifications,
  };

  return pi as any;
}

function createMockCtx(overrides: Record<string, any> = {}) {
  return {
    hasUI: true,
    ui: {
      notify: (_msg: string, _type: string) => {},
    },
    ...overrides,
  } as any;
}

// ── detectWorktree tests (via extension behavior) ────────────────

describe("worktree-scope extension", () => {
  describe("extension registration", () => {
    it("registers session_start and tool_call handlers", () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();
      expect(handlers["session_start"]).toBeDefined();
      expect(handlers["session_start"].length).toBe(1);
      expect(handlers["tool_call"]).toBeDefined();
      expect(handlers["tool_call"].length).toBe(1);
      expect(handlers["before_agent_start"]).toBeDefined();
    });
  });

  describe("tool_call blocking", () => {
    it("blocks edit to path outside worktree", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      // Create a temp directory to simulate a worktree
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      const gitFile = path.join(tmpDir, ".git");
      fs.writeFileSync(gitFile, `gitdir: /fake/main/.git/worktrees/test-branch`);

      // Simulate session_start to set worktreeInfo
      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      // Try to edit a file outside the worktree
      const result = await handlers["tool_call"][0](
        {
          toolName: "edit",
          input: { path: "/var/home/sebas/dotfiles/nvim/.config/nvim/init.lua" },
        },
        createMockCtx(),
      );

      expect(result).toBeDefined();
      expect(result.block).toBe(true);
      expect(result.reason).toContain("outside the worktree scope");

      // Cleanup
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("blocks write to path outside worktree", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      fs.writeFileSync(path.join(tmpDir, ".git"), `gitdir: /fake/main/.git/worktrees/test-branch`);

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["tool_call"][0](
        {
          toolName: "write",
          input: { path: "/tmp/outside-worktree.txt" },
        },
        createMockCtx(),
      );

      expect(result).toBeDefined();
      expect(result.block).toBe(true);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("allows edit to path inside worktree", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      fs.writeFileSync(path.join(tmpDir, ".git"), `gitdir: /fake/main/.git/worktrees/test-branch`);

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["tool_call"][0](
        {
          toolName: "edit",
          input: { path: path.join(tmpDir, "some-file.ts") },
        },
        createMockCtx(),
      );

      expect(result).toBeUndefined();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("allows relative paths inside worktree", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      fs.writeFileSync(path.join(tmpDir, ".git"), `gitdir: /fake/main/.git/worktrees/test-branch`);

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["tool_call"][0](
        {
          toolName: "edit",
          input: { path: "src/some-file.ts" }, // Relative path
        },
        createMockCtx(),
      );

      expect(result).toBeUndefined();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("does not block read tool", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      fs.writeFileSync(path.join(tmpDir, ".git"), `gitdir: /fake/main/.git/worktrees/test-branch`);

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["tool_call"][0](
        {
          toolName: "read",
          input: { path: "/any/path/outside/worktree" },
        },
        createMockCtx(),
      );

      expect(result).toBeUndefined();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("does not block when not in a worktree (main repo)", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      // Create .git as directory (main repo)
      fs.mkdirSync(path.join(tmpDir, ".git"));

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["tool_call"][0](
        {
          toolName: "edit",
          input: { path: "/any/path/outside" },
        },
        createMockCtx(),
      );

      expect(result).toBeUndefined();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("does not block when no .git exists", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      // No .git at all

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["tool_call"][0](
        {
          toolName: "edit",
          input: { path: "/any/path" },
        },
        createMockCtx(),
      );

      expect(result).toBeUndefined();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe("system prompt injection", () => {
    it("injects worktree scope into system prompt", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      fs.writeFileSync(path.join(tmpDir, ".git"), `gitdir: /fake/main/.git/worktrees/test-branch`);

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["before_agent_start"][0]({
        systemPrompt: "Original prompt",
      });

      expect(result.systemPrompt).toContain("Original prompt");
      expect(result.systemPrompt).toContain("Worktree Scope Enforcement");
      expect(result.systemPrompt).toContain(tmpDir);

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("does not inject when not in worktree", async () => {
      const pi = createMockPi();
      worktreeScopeExtension(pi);
      const handlers = pi.getHandlers();

      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "wt-test-"));
      fs.mkdirSync(path.join(tmpDir, ".git"));

      await handlers["session_start"][0]({}, createMockCtx({ cwd: tmpDir }));

      const result = await handlers["before_agent_start"][0]({
        systemPrompt: "Original prompt",
      });

      expect(result).toBeUndefined();

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });
});
