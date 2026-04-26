import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { main } from "./cli.ts";

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "issue-cli-"));
}

// ── CLI: main ──

describe("main", () => {
  let tmpDir: string;
  let env: Record<string, string>;

  beforeEach(() => {
    tmpDir = makeTmpDir();
    env = { WIKI_DIR: tmpDir, RAW_DIR: join(tmpDir, "raw-inbox") };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  // ── Help ──

  test("shows help text with --help", async () => {
    const out = await main(["--help"], env);
    expect(out).toContain("issue");
    expect(out).toContain("new");
    expect(out).toContain("list");
    expect(out).toContain("move");
    expect(out).toContain("block");
    expect(out).toContain("close");
  });

  test("shows help text with no args", async () => {
    const out = await main([], env);
    expect(out).toContain("Usage:");
  });

  test("shows help for unknown command", async () => {
    const out = await main(["unknown"], env);
    expect(out).toContain("Usage:");
  });

  // ── new ──

  test("new creates an issue with project and tags", async () => {
    const out = await main(
      ["new", "fix-stow-bug", "--project", "sebbaflow", "--tags", "bug,tmux"],
      env,
    );

    expect(out).toContain("fix-stow-bug");
    const issuesDir = join(tmpDir, "issues");
    expect(existsSync(join(issuesDir, "fix-stow-bug.md"))).toBe(true);

    // Verify created via list
    const listOut = await main(["list"], env);
    expect(listOut).toContain("fix-stow-bug");
    expect(listOut).toContain("sebbaflow");
  });

  test("new requires --project", async () => {
    const out = await main(["new", "no-project"], env);
    expect(out).toContain("--project");
  });

  test("new shows error for missing slug", async () => {
    const out = await main(["new"], env);
    expect(out).toContain("slug");
  });

  // ── list ──

  test("list shows all issues", async () => {
    // Create a couple issues first
    await main(["new", "issue-a", "--project", "sebbaflow", "--tags", "bug"], env);
    await main(["new", "issue-b", "--project", "sebbaflow", "--tags", "feature"], env);

    const out = await main(["list"], env);
    expect(out).toContain("issue-a");
    expect(out).toContain("issue-b");
    expect(out).toContain("bug");
    expect(out).toContain("feature");
  });

  test("list filters by --status", async () => {
    await main(["new", "movable-item", "--project", "sebbaflow", "--tags", "test"], env);
    await main(["move", "movable-item", "in-progress"], env);

    const out = await main(["list", "--status", "in-progress"], env);
    expect(out).toContain("movable-item");
    expect(out).toContain("in-progress");

    const outBacklog = await main(["list", "--status", "backlog"], env);
    expect(outBacklog).not.toContain("movable-item");
  });

  test("list filters by --project", async () => {
    await main(["new", "proj-a", "--project", "alpha", "--tags", ""], env);
    await main(["new", "proj-b", "--project", "beta", "--tags", ""], env);

    const out = await main(["list", "--project", "alpha"], env);
    expect(out).toContain("proj-a");
    expect(out).not.toContain("proj-b");
  });

  test("list shows empty message when no issues exist", async () => {
    const out = await main(["list"], env);
    expect(out).toContain("No issues");
  });

  // ── move ──

  test("move updates issue status", async () => {
    await main(["new", "task", "--project", "sebbaflow", "--tags", ""], env);
    const out = await main(["move", "task", "in-progress"], env);

    expect(out).toContain("task");
    expect(out).toContain("in-progress");

    const listOut = await main(["list"], env);
    expect(listOut).toContain("in-progress");
  });

  test("move shows error for non-existent issue", async () => {
    const out = await main(["move", "nonexistent", "done"], env);
    expect(out).toContain("Error");
  });

  // ── block ──

  test("block sets blocked-by", async () => {
    await main(["new", "blocked-item", "--project", "sebbaflow", "--tags", ""], env);
    await main(["new", "blocker-item", "--project", "sebbaflow", "--tags", ""], env);

    const out = await main(["block", "blocked-item", "--by", "blocker-item"], env);
    expect(out).toContain("blocked-item");
    expect(out).toContain("blocker-item");
  });

  test("block shows error for non-existent issue", async () => {
    const out = await main(["block", "nonexistent", "--by", "blocker"], env);
    expect(out).toContain("Error");
  });

  test("block shows error when --by is missing", async () => {
    await main(["new", "missing-by", "--project", "sebbaflow", "--tags", ""], env);
    const out = await main(["block", "missing-by"], env);
    expect(out).toContain("--by");
  });

  // ── close ──

  test("close moves file to inbox", async () => {
    await main(["new", "done-item", "--project", "sebbaflow", "--tags", "bug"], env);

    const out = await main(["close", "done-item"], env);
    expect(out).toContain("done-item");

    // File should be moved out of issues/
    expect(existsSync(join(tmpDir, "issues", "done-item.md"))).toBe(false);

    // File should be in the raw inbox
    const rawDir = join(tmpDir, "raw-inbox");
    expect(existsSync(join(rawDir, "done-item.md"))).toBe(true);
  });

  test("close --delete removes file entirely", async () => {
    await main(["new", "trash-item", "--project", "sebbaflow", "--tags", "chore"], env);

    const out = await main(["close", "trash-item", "--delete"], env);
    expect(out).toContain("trash-item");
    expect(out).toContain("deleted");

    expect(existsSync(join(tmpDir, "issues", "trash-item.md"))).toBe(false);
    expect(existsSync(join(join(tmpDir, "raw-inbox"), "trash-item.md"))).toBe(false);
  });

  test("close shows error for non-existent issue", async () => {
    const out = await main(["close", "nonexistent"], env);
    expect(out).toContain("Error");
  });
});
