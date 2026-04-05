/**
 * Claude Rules type definitions.
 */

/** A parsed rule loaded from .claude/rules/*.md */
export interface ClaudeRule {
  /** Relative path from project root, e.g. ".claude/rules/typescript.md" */
  filePath: string;
  /** Human-readable description (from frontmatter, defaults to filename) */
  description: string;
  /** Compiled matchers for path-scoped rules */
  matchers: Array<(p: string) => boolean>;
  /** The rule body (everything after the frontmatter) */
  body: string;
}
