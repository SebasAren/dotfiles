import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseFrontmatter, stringifyFrontmatter, type IssueFrontmatter } from "./frontmatter.ts";

/**
 * Read an issue file from disk.
 * The file is expected at {wikiDir}/issues/{slug}.md.
 * Throws if the file doesn't exist or has invalid frontmatter.
 */
export function readIssue(
  wikiDir: string,
  slug: string,
): { frontmatter: IssueFrontmatter; body: string } {
  const filePath = join(wikiDir, "issues", `${slug}.md`);
  const content = readFileSync(filePath, "utf-8");
  return parseFrontmatter(content);
}

/**
 * Write an issue file to disk.
 * Creates the {wikiDir}/issues/ directory if it doesn't exist.
 * Writes to {wikiDir}/issues/{slug}.md.
 */
export function writeIssue(
  wikiDir: string,
  slug: string,
  frontmatter: IssueFrontmatter,
  body: string,
): void {
  const filePath = join(wikiDir, "issues", `${slug}.md`);
  const content = stringifyFrontmatter(frontmatter, body);
  mkdirSync(join(wikiDir, "issues"), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
}
