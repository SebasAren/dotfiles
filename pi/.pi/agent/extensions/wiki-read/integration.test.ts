import { describe, it, expect, mock, beforeEach } from "bun:test";
import { piCodingAgentMock, piTuiMock, typeboxMock } from "@pi-ext/shared/test-mocks";
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";

// Mock external dependencies with shared mock factories
mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@mariozechner/pi-tui", piTuiMock);
mock.module("typebox", typeboxMock);

import wikiReadExtension, { executeWikiRead } from "./index";

describe("wiki-read extension", () => {
  beforeEach(() => {
    process.env.HOME = "/tmp/test-home";
  });

  it("can be loaded without errors", () => {
    const mockApi = {
      registerTool: mock(() => {}),
      registerCommand: mock(() => {}),
    };
    expect(() => wikiReadExtension(mockApi as any)).not.toThrow();
  });

  it("registers a tool named 'wiki_read'", () => {
    const registeredTools: any[] = [];
    const mockApi = {
      registerTool: (tool: any) => {
        registeredTools.push(tool);
      },
      registerCommand: mock(() => {}),
    };
    wikiReadExtension(mockApi as any);
    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("wiki_read");
  });

  it("reads a wiki page by relative path", () => {
    const originalHome = process.env.HOME;
    const tmpHome = mkdtempSync("/tmp/wiki-read-test-");
    process.env.HOME = tmpHome;

    try {
      const wikiDir = `${tmpHome}/Documents/wiki/wiki`;
      mkdirSync(`${wikiDir}/concepts`, { recursive: true });
      writeFileSync(`${wikiDir}/concepts/test.md`, "# Test Page\n\nHello wiki.");

      const result = executeWikiRead({ path: "concepts/test.md" });
      expect(result.content[0].text).toBe("# Test Page\n\nHello wiki.");
      expect(result.details.path).toBe(`${wikiDir}/concepts/test.md`);
      expect(result.details.size).toBe(24);
    } finally {
      rmSync(tmpHome, { recursive: true, force: true });
      process.env.HOME = originalHome;
    }
  });

  it("rejects paths outside the wiki directory", () => {
    expect(() => executeWikiRead({ path: "../../etc/passwd" })).toThrow("outside the wiki directory");
  });

  it("reads a wiki page by absolute path", () => {
    const originalHome = process.env.HOME;
    const tmpHome = mkdtempSync("/tmp/wiki-read-test-");
    process.env.HOME = tmpHome;

    try {
      const wikiDir = `${tmpHome}/Documents/wiki/wiki`;
      mkdirSync(`${wikiDir}/entities`, { recursive: true });
      writeFileSync(`${wikiDir}/entities/test.md`, "# Entity\n");

      const result = executeWikiRead({ path: `${wikiDir}/entities/test.md` });
      expect(result.content[0].text).toBe("# Entity\n");
    } finally {
      rmSync(tmpHome, { recursive: true, force: true });
      process.env.HOME = originalHome;
    }
  });

  it("throws for missing files", () => {
    expect(() => executeWikiRead({ path: "concepts/does-not-exist.md" })).toThrow("Failed to read wiki page");
  });
});
