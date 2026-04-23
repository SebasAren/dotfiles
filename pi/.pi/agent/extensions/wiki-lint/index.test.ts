/**
 * Wiki Lint Extension — unit tests.
 */

import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

beforeAll(() => {
  mock.module("@mariozechner/pi-coding-agent", () => ({
    DEFAULT_MAX_BYTES: 100_000,
    DEFAULT_MAX_LINES: 500,
    truncateHead: (text: string) => ({ content: text, truncated: false }),
  }));
  mock.module("@mariozechner/pi-tui", () => ({
    Text: class {
      text = "";
      constructor(text: string, _x: number, _y: number) {
        this.text = text;
      }
      setText(t: string) {
        this.text = t;
      }
    },
  }));
});

import { runLintChecks } from "./index";

// ── Test fixtures ──────────────────────────────────────────────────────────

function createFixtureWiki(): string {
  const dir = mkdtempSync(join(tmpdir(), "wiki-lint-test-"));
  const wikiDir = join(dir, "wiki");
  const rawDir = join(dir, "raw", "inbox");

  for (const sub of ["concepts", "entities", "sources", "synthesis", "analysis"]) {
    mkdirSync(join(wikiDir, sub), { recursive: true });
  }
  mkdirSync(rawDir, { recursive: true });

  // Good page with H1 and links
  writeFileSync(
    join(wikiDir, "concepts", "agent-swarm.md"),
    "# Agent Swarm\n\nSee also [[orchestration]] and [[kimi-k2]].\n",
  );

  // Page that links to agent-swarm (so it's not orphaned)
  writeFileSync(
    join(wikiDir, "concepts", "orchestration.md"),
    "# Orchestration\n\nUses [[agent-swarm]] for coordination.\n",
  );

  // Page with missing H1
  writeFileSync(join(wikiDir, "concepts", "no-title.md"), "This page has no H1 title.\n");

  // Orphan page (nothing links to it)
  writeFileSync(
    join(wikiDir, "entities", "orphan-entity.md"),
    "# Orphan Entity\n\nA lonely entity.\n",
  );

  // Page with broken link
  writeFileSync(
    join(wikiDir, "concepts", "broken-links.md"),
    "# Broken Links\n\nSee [[does-not-exist]] and [[also-missing|alias]].\n",
  );

  // Empty page
  writeFileSync(join(wikiDir, "concepts", "empty-page.md"), "# Empty\n");

  // Proper entity linked from agent-swarm
  writeFileSync(
    join(wikiDir, "entities", "kimi-k2.md"),
    "# Kimi K2\n\nA model by [[moonshot-ai]].\n",
  );

  // Entity referenced nowhere
  writeFileSync(join(wikiDir, "entities", "moonshot-ai.md"), "# Moonshot AI\n\nA company.\n");

  // Inbox file (old enough to flag)
  const oldFile = join(rawDir, "old-note.md");
  writeFileSync(oldFile, "old content");
  // Set mtime to 5 days ago
  const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
  utimesSync(oldFile, new Date(fiveDaysAgo), new Date(fiveDaysAgo));

  return dir;
}

// ── runLintChecks ──────────────────────────────────────────────────────────

describe("runLintChecks", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = createFixtureWiki();
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("detects broken wiki links", async () => {
    const results = await runLintChecks(fixtureDir, ["broken-links"]);
    const broken = results.find((r) => r.check === "broken-links")!;
    expect(broken).toBeDefined();
    expect(broken.issues.length).toBeGreaterThanOrEqual(2);
    expect(broken.issues.some((i) => i.message.includes("does-not-exist"))).toBe(true);
    expect(broken.issues.some((i) => i.message.includes("also-missing"))).toBe(true);
  });

  it("detects orphan pages", async () => {
    const results = await runLintChecks(fixtureDir, ["orphans"]);
    const orphans = results.find((r) => r.check === "orphans")!;
    expect(orphans).toBeDefined();
    const orphanSlugs = orphans.issues.map((i) => i.path);
    expect(orphanSlugs.some((p) => p.includes("orphan-entity"))).toBe(true);
    // moonshot-ai is linked from kimi-k2, so it's NOT an orphan
    // agent-swarm is linked from orchestration, should NOT be orphan
    expect(orphanSlugs.every((p) => !p.includes("agent-swarm"))).toBe(true);
    expect(orphanSlugs.every((p) => !p.includes("moonshot-ai"))).toBe(true);
  });

  it("detects missing H1 titles", async () => {
    const results = await runLintChecks(fixtureDir, ["missing-h1"]);
    const titles = results.find((r) => r.check === "missing-h1")!;
    expect(titles).toBeDefined();
    expect(titles.issues.some((i) => i.path.includes("no-title"))).toBe(true);
    expect(titles.issues.every((i) => !i.path.includes("agent-swarm"))).toBe(true);
  });

  it("detects filename violations", async () => {
    // Create a file with bad name
    writeFileSync(join(fixtureDir, "wiki", "concepts", "Bad_Name.md"), "# Bad Name\n");

    const results = await runLintChecks(fixtureDir, ["filename"]);
    const names = results.find((r) => r.check === "filename")!;
    expect(names).toBeDefined();
    expect(names.issues.some((i) => i.path.includes("Bad_Name"))).toBe(true);

    // Cleanup
    rmSync(join(fixtureDir, "wiki", "concepts", "Bad_Name.md"));
  });

  it("detects empty pages", async () => {
    const results = await runLintChecks(fixtureDir, ["empty-pages"]);
    const empty = results.find((r) => r.check === "empty-pages")!;
    expect(empty).toBeDefined();
    expect(empty.issues.some((i) => i.path.includes("empty-page"))).toBe(true);
  });

  it("detects stale inbox files", async () => {
    const results = await runLintChecks(fixtureDir, ["inbox-orphans"]);
    const inbox = results.find((r) => r.check === "inbox-orphans")!;
    expect(inbox).toBeDefined();
    expect(inbox.issues.some((i) => i.path.includes("old-note"))).toBe(true);
  });

  it("runs all checks when none specified", async () => {
    const results = await runLintChecks(fixtureDir);
    const checkNames = results.map((r) => r.check);
    expect(checkNames).toContain("broken-links");
    expect(checkNames).toContain("orphans");
    expect(checkNames).toContain("missing-h1");
    expect(checkNames).toContain("filename");
    expect(checkNames).toContain("empty-pages");
    expect(checkNames).toContain("inbox-orphans");
  });

  it("returns empty issues for clean subset", async () => {
    // Only check filename on the well-named files
    const results = await runLintChecks(fixtureDir, ["filename"]);
    const fn = results.find((r) => r.check === "filename")!;
    // Fixture has no bad filenames by default (we clean up the temp one)
    // The good files: agent-swarm, orchestration, no-title, broken-links, empty-page, kimi-k2, moonshot-ai, orphan-entity
    expect(fn.issues.every((i) => !i.path.includes("agent-swarm"))).toBe(true);
  });
});

// ── Bug fix regressions ────────────────────────────────────────────────────

describe("broken-links: code span exclusion", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "wiki-lint-code-"));
    const wikiDir = join(fixtureDir, "wiki");
    mkdirSync(join(wikiDir, "concepts"), { recursive: true });

    // Page with links inside backticks — should NOT be flagged
    writeFileSync(
      join(wikiDir, "concepts", "code-links.md"),
      "# Code Links\n\nUse `[[page-name]]` for links. See also [[real-page]].\n",
    );

    // The real page that exists
    writeFileSync(
      join(wikiDir, "concepts", "real-page.md"),
      "# Real Page\n\nReferenced by [[code-links]].\n",
    );
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("ignores links inside inline code spans", async () => {
    const results = await runLintChecks(fixtureDir, ["broken-links"]);
    const broken = results.find((r) => r.check === "broken-links")!;
    // page-name is inside backticks and should NOT appear as a broken link
    expect(broken.issues.every((i) => !i.message.includes("page-name"))).toBe(true);
  });

  it("still detects real broken links outside code spans", async () => {
    const results = await runLintChecks(fixtureDir, ["broken-links"]);
    const broken = results.find((r) => r.check === "broken-links")!;
    // real-page exists, so no broken links at all
    expect(broken.issues.length).toBe(0);
  });

  it("ignores links inside fenced code blocks", async () => {
    const fixtureFenced = mkdtempSync(join(tmpdir(), "wiki-lint-fenced-"));
    const wikiDir = join(fixtureFenced, "wiki");
    mkdirSync(join(wikiDir, "concepts"), { recursive: true });

    writeFileSync(
      join(wikiDir, "concepts", "fenced.md"),
      "# Fenced\n\n```\n[[nonexistent-inside-fence]]\n```\n\nReal link: [[target]].\n",
    );
    writeFileSync(join(wikiDir, "concepts", "target.md"), "# Target\n\nReferenced.\n");

    const results = await runLintChecks(fixtureFenced, ["broken-links"]);
    const broken = results.find((r) => r.check === "broken-links")!;
    expect(broken.issues.every((i) => !i.message.includes("nonexistent-inside-fence"))).toBe(true);
    expect(broken.issues.length).toBe(0);

    rmSync(fixtureFenced, { recursive: true, force: true });
  });
});

describe("broken-links: root-level wiki pages", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "wiki-lint-root-"));
    const wikiDir = join(fixtureDir, "wiki");
    mkdirSync(join(wikiDir, "concepts"), { recursive: true });

    // Root-level page (not in a subdir)
    writeFileSync(join(wikiDir, "overview.md"), "# Overview\n\nThe wiki overview.\n");

    // Page linking to the root-level page
    writeFileSync(
      join(wikiDir, "concepts", "home.md"),
      "# Home\n\nSee [[overview]] for the overview.\n",
    );
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("resolves links to root-level wiki pages", async () => {
    const results = await runLintChecks(fixtureDir, ["broken-links"]);
    const broken = results.find((r) => r.check === "broken-links")!;
    // overview.md exists at wiki/ root and should be found
    expect(broken.issues.every((i) => !i.message.includes("overview"))).toBe(true);
    expect(broken.issues.length).toBe(0);
  });
});

describe("missing-h1: YAML frontmatter skip", () => {
  let fixtureDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "wiki-lint-h1-"));
    const wikiDir = join(fixtureDir, "wiki");
    mkdirSync(join(wikiDir, "concepts"), { recursive: true });

    // Page with YAML frontmatter then H1 — should NOT be flagged
    writeFileSync(
      join(wikiDir, "concepts", "with-frontmatter.md"),
      "---\ntags:\n  - type/concept\n---\n\n# With Frontmatter\n\nContent here.\n",
    );

    // Page with YAML frontmatter but NO H1 after — SHOULD be flagged
    writeFileSync(
      join(wikiDir, "concepts", "no-h1-frontmatter.md"),
      "---\ntags:\n  - type/concept\n---\n\nNo heading here.\n",
    );
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("skips YAML frontmatter and checks H1 after it", async () => {
    const results = await runLintChecks(fixtureDir, ["missing-h1"]);
    const h1 = results.find((r) => r.check === "missing-h1")!;
    // with-frontmatter has H1 after frontmatter — should NOT be flagged
    expect(h1.issues.every((i) => !i.path.includes("with-frontmatter"))).toBe(true);
    // no-h1-frontmatter has no H1 after frontmatter — SHOULD be flagged
    expect(h1.issues.some((i) => i.path.includes("no-h1-frontmatter"))).toBe(true);
  });
});
