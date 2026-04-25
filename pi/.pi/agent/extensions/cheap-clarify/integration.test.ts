import { describe, expect, it, mock } from "bun:test";
import { piCodingAgentMock, piTuiMock } from "@pi-ext/shared/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);

// Now import the extension after mocks are set up
import clarifyExtension from "./index";

describe("cheap-clarify extension", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      registerCommand: mock(() => {}),
      sendUserMessage: mock(() => {}),
    };
    expect(() => clarifyExtension(mockApi as any)).not.toThrow();
  });

  it("registers a command named 'clarify'", () => {
    const registeredCommands: { name: string; command: any }[] = [];
    const mockApi = {
      registerCommand: (name: string, command: any) => {
        registeredCommands.push({ name, command });
      },
      sendUserMessage: mock(() => {}),
    };
    clarifyExtension(mockApi as any);
    expect(registeredCommands).toHaveLength(1);
    expect(registeredCommands[0].name).toBe("clarify");
    expect(registeredCommands[0].command.description).toContain("questionnaire");
  });
});
