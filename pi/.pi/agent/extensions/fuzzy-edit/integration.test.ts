import { describe, it, expect, mock } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { piCodingAgentMock, typeboxMock } from "../shared/src/test-mocks";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@sinclair/typebox", typeboxMock);

import fuzzyEditExtension from "./index";

describe("fuzzy-edit extension", () => {
  it("can be loaded without errors", () => {
    const mockApi = {
      registerTool: mock(() => {}),
    };
    expect(() => fuzzyEditExtension(mockApi as any)).not.toThrow();
  });

  it("registers a tool named 'edit'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    fuzzyEditExtension(mockApi as any);
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("edit");
  });

  it("has prepareArguments function", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    fuzzyEditExtension(mockApi as any);
    expect(typeof registeredTools[0].prepareArguments).toBe("function");
  });

  it("preserves CRLF line endings when editing a CRLF file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "fuzzy-edit-crlf-"));
    const file = join(dir, "sample.txt");
    writeFileSync(file, "hello\r\nworld\r\nfoo\r\n");

    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => registeredTools.push(tool),
    };
    fuzzyEditExtension(mockApi as any);
    const editTool = registeredTools[0];

    await editTool.execute(
      "call-1",
      { path: file, edits: [{ oldText: "world", newText: "WORLD" }] },
      undefined,
      undefined,
      {},
    );

    const written = readFileSync(file, "utf-8");
    expect(written).toBe("hello\r\nWORLD\r\nfoo\r\n");
  });
});
