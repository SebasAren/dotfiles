import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createIssue, listIssues, moveIssue, blockIssue, closeIssue } from "./commands.ts";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "issue-test-"));
}

// ── createIssue ──

describe("createIssue", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("writes a file at issues/<slug>.md with correct frontmatter and body template", () => {
    createIssue(tmpDir, "fix-stow-bug", {
      project: "sebbaflow",
      tags: ["bug", "stow"],
    });

    const filePath = join(tmpDir, "issues", "fix-stow-bug.md");
    expect(existsSync(filePath)).toBe(true);

    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("type: issue");
    expect(content).toContain("status: backlog");
    expect(content).toContain("project: sebbaflow");
    expect(content).toContain("tags: [bug, stow]");
    expect(content).toContain("created:");
    expect(content).toContain("## Description");
    expect(content).toContain("## Steps to Reproduce");
    expect(content).toContain("## Acceptance Criteria");
  });

  test("sets status to backlog and type to issue", () => {
    createIssue(tmpDir, "test-issue", {
      project: "sebbaflow",
      tags: [],
    });

    const filePath = join(tmpDir, "issues", "test-issue.md");
    const content = readFileSync(filePath, "utf-8");
    expect(content).toContain("type: issue");
    expect(content).toContain("status: backlog");
  });

  test("sets created to today's ISO date", () => {
    createIssue(tmpDir, "dated-issue", {
      project: "test",
      tags: [],
    });

    const filePath = join(tmpDir, "issues", "dated-issue.md");
    const content = readFileSync(filePath, "utf-8");
    const today = new Date().toISOString().slice(0, 10);
    expect(content).toContain(`created: ${today}`);
  });

  test("creates the issues directory if it doesn't exist", () => {
    expect(existsSync(join(tmpDir, "issues"))).toBe(false);
    createIssue(tmpDir, "new-dir", {
      project: "sebbaflow",
      tags: [],
    });
    expect(existsSync(join(tmpDir, "issues"))).toBe(true);
  });
});

// ── listIssues ──

describe("listIssues", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    // Create a few issues for testing
    createIssue(tmpDir, "issue-one", {
      project: "sebbaflow",
      tags: ["bug"],
    });
    createIssue(tmpDir, "issue-two", {
      project: "sebbaflow",
      tags: ["feature"],
    });
    createIssue(tmpDir, "issue-three", {
      project: "other-proj",
      tags: ["docs"],
    });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns all issues when no filters are provided", () => {
    const issues = listIssues(tmpDir);
    expect(issues).toHaveLength(3);
    const slugs = issues.map((i) => i.slug).sort();
    expect(slugs).toEqual(["issue-one", "issue-three", "issue-two"]);
  });

  test("filters by status", () => {
    const issues = listIssues(tmpDir, { status: "backlog" });
    expect(issues).toHaveLength(3); // all are backlog

    const none = listIssues(tmpDir, { status: "in-progress" });
    expect(none).toHaveLength(0);
  });

  test("filters by project", () => {
    const issues = listIssues(tmpDir, { project: "sebbaflow" });
    expect(issues).toHaveLength(2);
    expect(issues.map((i) => i.slug).sort()).toEqual(["issue-one", "issue-two"]);

    const other = listIssues(tmpDir, { project: "other-proj" });
    expect(other).toHaveLength(1);
    expect(other[0].slug).toBe("issue-three");
  });

  test("filters by both status and project", () => {
    const issues = listIssues(tmpDir, {
      status: "backlog",
      project: "sebbaflow",
    });
    expect(issues).toHaveLength(2);

    // Non-matching status
    const none = listIssues(tmpDir, {
      status: "done",
      project: "sebbaflow",
    });
    expect(none).toHaveLength(0);
  });

  test("returns issue objects with slug, frontmatter, and body", () => {
    const issues = listIssues(tmpDir);
    const issue = issues.find((i) => i.slug === "issue-one");
    expect(issue).toBeDefined();
    expect(issue!.frontmatter.type).toBe("issue");
    expect(issue!.frontmatter.status).toBe("backlog");
    expect(issue!.frontmatter.project).toBe("sebbaflow");
    expect(issue!.frontmatter.tags).toEqual(["bug"]);
    expect(issue!.body).toContain("## Description");
  });
});

// ── moveIssue ──

describe("moveIssue", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    createIssue(tmpDir, "movable", {
      project: "sebbaflow",
      tags: [],
    });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("updates status in frontmatter", async () => {
    moveIssue(tmpDir, "movable", "in-progress");

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(join(tmpDir, "issues", "movable.md"), "utf-8");
    expect(content).toContain("status: in-progress");
    expect(content).not.toContain("status: backlog");
  });

  test("preserves other frontmatter fields", async () => {
    moveIssue(tmpDir, "movable", "done");

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(join(tmpDir, "issues", "movable.md"), "utf-8");
    expect(content).toContain("type: issue");
    expect(content).toContain("project: sebbaflow");
    expect(content).toContain("## Description");
  });

  test("accepts all valid statuses", async () => {
    moveIssue(tmpDir, "movable", "backlog");
    moveIssue(tmpDir, "movable", "in-progress");
    moveIssue(tmpDir, "movable", "done");

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(join(tmpDir, "issues", "movable.md"), "utf-8");
    expect(content).toContain("status: done");
  });

  test("throws for non-existent issue", () => {
    expect(() => moveIssue(tmpDir, "nonexistent", "done")).toThrow();
  });
});

// ── blockIssue ──

describe("blockIssue", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    createIssue(tmpDir, "blocked-one", { project: "sebbaflow", tags: [] });
    createIssue(tmpDir, "blocked-two", { project: "sebbaflow", tags: [] });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("sets blocked-by to wikilink format", async () => {
    blockIssue(tmpDir, "blocked-one", "other-issue");

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(join(tmpDir, "issues", "blocked-one.md"), "utf-8");
    expect(content).toContain('blocked-by: "[[other-issue]]"');
  });

  test("overwrites blocked-by on re-call", async () => {
    blockIssue(tmpDir, "blocked-one", "first-blocker");
    blockIssue(tmpDir, "blocked-one", "second-blocker");

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(join(tmpDir, "issues", "blocked-one.md"), "utf-8");
    expect(content).toContain('blocked-by: "[[second-blocker]]"');
    expect(content).not.toContain("first-blocker");
  });

  test("throws for non-existent issue", () => {
    expect(() => blockIssue(tmpDir, "nonexistent", "blocker")).toThrow();
  });
});

// ── closeIssue ──

describe("closeIssue", () => {
  let tmpDir: string;
  let rawDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    rawDir = makeTmpDir();
    createIssue(tmpDir, "close-me", { project: "sebbaflow", tags: ["bug"] });
    createIssue(tmpDir, "delete-me", { project: "sebbaflow", tags: ["chore"] });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    rmSync(rawDir, { recursive: true, force: true });
  });

  test("moves file from issues/ to raw/inbox/", () => {
    closeIssue(tmpDir, rawDir, "close-me");

    // Should no longer be in issues/
    expect(existsSync(join(tmpDir, "issues", "close-me.md"))).toBe(false);

    // Should be in raw/inbox/
    expect(existsSync(join(rawDir, "close-me.md"))).toBe(true);
  });

  test("creates raw/inbox/ directory if it doesn't exist", () => {
    expect(existsSync(rawDir)).toBe(true); // rawDir = makeTmpDir, already exists
    // Use a subdirectory that doesn't exist yet
    const nestedRaw = join(tmpDir, "nested-raw", "inbox");
    expect(existsSync(nestedRaw)).toBe(false);

    closeIssue(tmpDir, nestedRaw, "close-me");
    expect(existsSync(join(nestedRaw, "close-me.md"))).toBe(true);
  });

  test("deletes file when --delete option is set", () => {
    closeIssue(tmpDir, rawDir, "delete-me", { delete: true });

    // Should no longer be in issues/
    expect(existsSync(join(tmpDir, "issues", "delete-me.md"))).toBe(false);

    // Should not be in raw/inbox/ either
    expect(existsSync(join(rawDir, "delete-me.md"))).toBe(false);
  });

  test("throws for non-existent issue", () => {
    expect(() => closeIssue(tmpDir, rawDir, "nonexistent")).toThrow();
  });
});
