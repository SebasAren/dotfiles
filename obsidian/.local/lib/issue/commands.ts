import { readdirSync, renameSync, rmSync, mkdirSync } from "node:fs";
import { join, parse } from "node:path";
import {
  readIssue,
  writeIssue,
  type IssueFrontmatter,
} from "../wiki-core/index.ts";

export interface CreateIssueOptions {
  project: string;
  tags: string[];
}

export interface IssueRecord {
  slug: string;
  frontmatter: IssueFrontmatter;
  body: string;
}

export interface ListIssuesFilters {
  status?: "backlog" | "in-progress" | "done";
  project?: string;
}

export interface CloseIssueOptions {
  delete?: boolean;
}

/**
 * Create a new issue file at {wikiDir}/issues/{slug}.md.
 * Automatically creates the issues/ directory if it doesn't exist.
 * Sets type=issue, status=backlog, created=today with the given project and tags.
 * Body includes Description, Steps to Reproduce, and Acceptance Criteria sections.
 */
export function createIssue(
  wikiDir: string,
  slug: string,
  options: CreateIssueOptions,
): void {
  const frontmatter: IssueFrontmatter = {
    type: "issue",
    status: "backlog",
    tags: options.tags,
    created: new Date().toISOString().slice(0, 10),
    project: options.project,
  };

  const body = "\n## Description\n\n## Steps to Reproduce\n\n## Acceptance Criteria\n";

  writeIssue(wikiDir, slug, frontmatter, body);
}

/**
 * Move an issue to a new status.
 * Reads the issue, updates its status, and writes it back.
 */
export function moveIssue(
  wikiDir: string,
  slug: string,
  newStatus: "backlog" | "in-progress" | "done",
): void {
  const { frontmatter, body } = readIssue(wikiDir, slug);
  frontmatter.status = newStatus;
  writeIssue(wikiDir, slug, frontmatter, body);
}

/**
 * Block an issue on another issue.
 * Sets blocked-by to [[blockedBySlug]] wikilink format.
 * Overwrites any existing blocked-by value.
 */
export function blockIssue(
  wikiDir: string,
  slug: string,
  blockedBySlug: string,
): void {
  const { frontmatter, body } = readIssue(wikiDir, slug);
  frontmatter["blocked-by"] = `[[${blockedBySlug}]]`;
  writeIssue(wikiDir, slug, frontmatter, body);
}

/**
 * Close an issue.
 * By default, moves the file from {wikiDir}/issues/{slug}.md to {rawDir}/{slug}.md.
 * With {delete: true}, removes the file entirely.
 */
export function closeIssue(
  wikiDir: string,
  rawDir: string,
  slug: string,
  options?: CloseIssueOptions,
): void {
  const sourcePath = join(wikiDir, "issues", `${slug}.md`);

  // Read to verify the issue exists (will throw if not)
  readIssue(wikiDir, slug);

  if (options?.delete) {
    rmSync(sourcePath);
  } else {
    const destPath = join(rawDir, `${slug}.md`);
    mkdirSync(rawDir, { recursive: true });
    renameSync(sourcePath, destPath);
  }
}

/**
 * List issues in the {wikiDir}/issues/ directory.
 * Optionally filter by status and/or project.
 * Returns an array of IssueRecord objects with slug, frontmatter, and body.
 */
export function listIssues(
  wikiDir: string,
  filters?: ListIssuesFilters,
): IssueRecord[] {
  const issuesDir = join(wikiDir, "issues");

  let files: string[];
  try {
    files = readdirSync(issuesDir);
  } catch {
    return [];
  }

  const issues: IssueRecord[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const slug = parse(file).name;
    try {
      const { frontmatter, body } = readIssue(wikiDir, slug);

      // Apply filters
      if (filters?.status && frontmatter.status !== filters.status) continue;
      if (filters?.project && frontmatter.project !== filters.project) continue;

      issues.push({ slug, frontmatter, body });
    } catch {
      // Skip files that can't be parsed
      continue;
    }
  }

  return issues;
}
