import { describe, it, expect } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { findMarkdownFiles, createMatcher, loadRules } from "./rules";

describe("findMarkdownFiles", () => {
  it("finds .md files in a directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    fs.writeFileSync(path.join(tmpDir, "a.md"), "content a");
    fs.writeFileSync(path.join(tmpDir, "b.md"), "content b");
    fs.writeFileSync(path.join(tmpDir, "c.txt"), "not markdown");

    const files = findMarkdownFiles(tmpDir);
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/\.md$/);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds .md files recursively", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(tmpDir, "top.md"), "top");
    fs.writeFileSync(path.join(subDir, "nested.md"), "nested");

    const files = findMarkdownFiles(tmpDir);
    expect(files).toHaveLength(2);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for non-existent directory", () => {
    const files = findMarkdownFiles("/nonexistent/path");
    expect(files).toEqual([]);
  });

  it("returns empty array for empty directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const files = findMarkdownFiles(tmpDir);
    expect(files).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe("createMatcher", () => {
  it("matches basename with matchBase for patterns without slashes", () => {
    const match = createMatcher("*.ts");
    expect(match("src/file.ts")).toBe(true);
    expect(match("README.md")).toBe(false);
  });

  it("matches full path for patterns with slashes", () => {
    const match = createMatcher("src/**/*.ts");
    expect(match("src/components/Button.ts")).toBe(true);
    expect(match("test/Button.ts")).toBe(false);
  });

  it("matches dotfiles when dot option is enabled", () => {
    const match = createMatcher(".env*");
    expect(match(".env")).toBe(true);
    expect(match(".env.local")).toBe(true);
    expect(match("env")).toBe(false);
  });
});

describe("loadRules", () => {
  it("loads rules from .claude/rules/ directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "typescript.md"),
      '---\npaths: ["*.ts"]\ndescription: TypeScript rules\n---\nUse strict mode.',
    );

    const rules = loadRules(tmpDir);
    expect(rules).toHaveLength(1);
    expect(rules[0].filePath).toBe(path.join(".claude", "rules", "typescript.md"));
    expect(rules[0].description).toBe("TypeScript rules");
    expect(rules[0].body).toBe("Use strict mode.");
    expect(rules[0].matchers).toHaveLength(1);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads global rules without globs/paths", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "global.md"),
      "---\ndescription: Global rules\n---\nAlways use conventional commits.",
    );

    const rules = loadRules(tmpDir);
    expect(rules).toHaveLength(1);
    expect(rules[0].matchers).toHaveLength(0);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array when no rules directory exists", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const rules = loadRules(tmpDir);
    expect(rules).toEqual([]);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("defaults description to filename without extension", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(path.join(rulesDir, "my-rules.md"), "Just the body, no frontmatter.");

    const rules = loadRules(tmpDir);
    expect(rules[0].description).toBe("my-rules");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles comma-separated paths", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rules-test-"));
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "multi.md"),
      '---\npaths: "**/*.ts, **/*.tsx"\n---\nBody.',
    );

    const rules = loadRules(tmpDir);
    expect(rules[0].matchers).toHaveLength(2);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
