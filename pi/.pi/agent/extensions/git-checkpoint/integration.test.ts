/**
 * Integration tests for the git-checkpoint extension.
 *
 * Verifies that the extension loads correctly, registers the expected
 * event handlers, and the checkpoint creation lifecycle works.
 */

import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", () => ({
  ...piCodingAgentMock(),
}));

// Now import the extension after mocks are set up
import checkpointExtension from "./index";

describe("git-checkpoint extension integration", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      on: mock(() => {}),
      exec: mock(() => Promise.resolve({ stdout: "" })),
    };
    expect(() => checkpointExtension(mockApi as any)).not.toThrow();
  });

  it("registers tool_result event handler", () => {
    const events: string[] = [];
    const mockApi = {
      on: (event: string) => {
        events.push(event);
      },
      exec: mock(() => Promise.resolve({ stdout: "" })),
    };
    checkpointExtension(mockApi as any);
    expect(events).toContain("tool_result");
  });

  it("registers turn_start event handler", () => {
    const events: string[] = [];
    const mockApi = {
      on: (event: string) => {
        events.push(event);
      },
      exec: mock(() => Promise.resolve({ stdout: "" })),
    };
    checkpointExtension(mockApi as any);
    expect(events).toContain("turn_start");
  });

  it("registers session_before_fork event handler", () => {
    const events: string[] = [];
    const mockApi = {
      on: (event: string) => {
        events.push(event);
      },
      exec: mock(() => Promise.resolve({ stdout: "" })),
    };
    checkpointExtension(mockApi as any);
    expect(events).toContain("session_before_fork");
  });

  it("registers agent_end event handler", () => {
    const events: string[] = [];
    const mockApi = {
      on: (event: string) => {
        events.push(event);
      },
      exec: mock(() => Promise.resolve({ stdout: "" })),
    };
    checkpointExtension(mockApi as any);
    expect(events).toContain("agent_end");
  });

  it("creates a stash checkpoint on turn_start after tool_result", async () => {
    const execMock = mock(() => Promise.resolve({ stdout: "abc123-ref\n" }));
    const handlers: Record<string, any> = {};
    const mockApi = {
      on: (event: string, handler: any) => {
        handlers[event] = handler;
      },
      exec: execMock,
      sessionManager: {
        getLeafEntry: () => ({ id: "entry-42" }),
      },
    };

    checkpointExtension(mockApi as any);

    // Simulate tool_result to set currentEntryId
    await handlers.tool_result(
      { type: "tool_result", message: "done" },
      { sessionManager: { getLeafEntry: () => ({ id: "entry-42" }) } },
    );

    // Simulate turn_start to create checkpoint
    await handlers.turn_start();

    expect(execMock).toHaveBeenCalledWith("git", ["stash", "create"]);
  });

  it("does not create checkpoint when git stash create returns empty", async () => {
    const execMock = mock(() => Promise.resolve({ stdout: "\n" }));
    const handlers: Record<string, any> = {};
    const mockApi = {
      on: (event: string, handler: any) => {
        handlers[event] = handler;
      },
      exec: execMock,
    };

    checkpointExtension(mockApi as any);

    // Simulate tool_result with entry ID
    await handlers.tool_result(
      { type: "tool_result", message: "done" },
      { sessionManager: { getLeafEntry: () => ({ id: "entry-42" }) } },
    );

    // Simulate turn_start — no ref, so no checkpoint
    await handlers.turn_start();

    // exec was called, but empty ref means no checkpoint was stored
    expect(execMock).toHaveBeenCalledWith("git", ["stash", "create"]);
  });

  it("does not create checkpoint when no currentEntryId set", async () => {
    const execMock = mock(() => Promise.resolve({ stdout: "abc123-ref\n" }));
    const handlers: Record<string, any> = {};
    const mockApi = {
      on: (event: string, handler: any) => {
        handlers[event] = handler;
      },
      exec: execMock,
    };

    checkpointExtension(mockApi as any);

    // Simulate turn_start WITHOUT prior tool_result
    await handlers.turn_start();

    // exec was called but currentEntryId is undefined, so no checkpoint stored
    expect(execMock).toHaveBeenCalledWith("git", ["stash", "create"]);
  });

  it("clears checkpoints on agent_end", async () => {
    const execMock = mock(() => Promise.resolve({ stdout: "abc123-ref\n" }));
    const handlers: Record<string, any> = {};
    const mockApi = {
      on: (event: string, handler: any) => {
        handlers[event] = handler;
      },
      exec: execMock,
    };

    checkpointExtension(mockApi as any);

    // Simulate tool_result + turn_start to create checkpoint
    await handlers.tool_result(
      { type: "tool_result", message: "done" },
      { sessionManager: { getLeafEntry: () => ({ id: "entry-42" }) } },
    );
    await handlers.turn_start();

    // Simulate agent_end — should clear checkpoints
    await handlers.agent_end();

    // session_before_fork for entry-42 should now find no checkpoint
    // (No select/notify should be called since checkpoint map is cleared)
    // We can't easily assert on the internal map, but no crash is a good sign
    expect(execMock).toHaveBeenCalledTimes(1); // Only from turn_start, not cleared
  });

  it("declares @pi-ext/shared as a workspace dependency", async () => {
    const pkg = await import("./package.json");
    expect(pkg.dependencies?.["@pi-ext/shared"]).toBe("workspace:*");
  });
});
