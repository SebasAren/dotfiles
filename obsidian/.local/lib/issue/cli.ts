import { parseArgs } from "node:util";
import { WIKI_DIR, RAW_DIR } from "../wiki-core/index.ts";
import {
  createIssue,
  listIssues,
  moveIssue,
  blockIssue,
  closeIssue,
} from "./commands.ts";

function formatIssueRow(
  slug: string,
  status: string,
  project: string,
  tags: string[],
): string {
  const tagStr = tags.length > 0 ? tags.join(", ") : "";
  return `  ${slug.padEnd(30)} ${status.padEnd(14)} ${project.padEnd(16)} ${tagStr}`;
}

function helpText(): string {
  return `issue - Obsidian Issue Tracker CLI

Usage:
  issue new <slug> --project <project> [--tags <tags>]
  issue list [--status <status>] [--project <project>]
  issue move <slug> <status>
  issue block <slug> --by <blocker>
  issue close <slug> [--delete]

Commands:
  new     Create a new issue (status: backlog)
  list    List issues (optionally filtered)
  move    Change an issue's status
  block   Block an issue on another issue
  close   Close an issue (moves to inbox or deletes)

Options:
  --project <name>    Project label
  --tags <list>       Comma-separated tags
  --status <status>   Filter or set status (backlog, in-progress, done)
  --by <slug>         Blocking issue slug
  --delete            Permanently delete the issue file
  --help              Show this help message`;
}

// ── Shared helpers ──

/** Prefix a message with "Error: " for consistent error formatting. */
function err(msg: string): string {
  return `Error: ${msg}`;
}

/** Format a "not found" error for an issue slug. */
function notFound(slug: string): string {
  return err(`Issue "${slug}" not found.`);
}

/** Require a positional slug argument. Returns an error string or null. */
function requireSlug(
  positionals: string[],
  usage: string,
): string | null {
  if (positionals.length === 0) {
    return err(`Missing issue slug. ${usage}`);
  }
  return null;
}

/** Run a fn that may throw, catching errors as "not found" errors. */
function safeRun(fn: () => string, slug: string): string {
  try {
    return fn();
  } catch {
    return notFound(slug);
  }
}

// ── Command handler ──

export async function main(
  args: string[],
  env: Record<string, string | undefined>,
): Promise<string> {
  const wikiDir = env.WIKI_DIR ?? WIKI_DIR;
  const rawDir = env.RAW_DIR ?? RAW_DIR;

  if (args.length === 0 || args[0] === "--help") {
    return helpText();
  }

  const command = args[0]!;
  const rest = args.slice(1);

  switch (command) {
    case "new":
      return handleNew(rest, wikiDir);
    case "list":
      return handleList(rest, wikiDir);
    case "move":
      return handleMove(rest, wikiDir);
    case "block":
      return handleBlock(rest, wikiDir);
    case "close":
      return handleClose(rest, wikiDir, rawDir);
    default:
      return `${err(`Unknown command "${command}". Use --help for usage.`)}

${helpText()}`;
  }
}

function handleNew(args: string[], wikiDir: string): string {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      project: { type: "string" },
      tags: { type: "string", default: "" },
    },
  });

  const missingSlug = requireSlug(
    positionals,
    "Usage: issue new <slug> --project <project> [--tags <tags>]",
  );
  if (missingSlug) return missingSlug;

  const slug = positionals[0]!;
  const project = values.project;

  if (!project) {
    return err("--project is required. Usage: issue new <slug> --project <project> [--tags <tags>]");
  }

  const tags = values.tags
    ? values.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : [];

  createIssue(wikiDir, slug, { project, tags });
  return `Created issue: ${slug} (project: ${project}, tags: [${tags.join(", ")}])`;
}

function handleList(args: string[], wikiDir: string): string {
  const { values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      status: { type: "string" },
      project: { type: "string" },
    },
  });

  const status = values.status as "backlog" | "in-progress" | "done" | undefined;
  const project = values.project;

  const issues = listIssues(wikiDir, {
    ...(status ? { status } : {}),
    ...(project ? { project } : {}),
  });

  if (issues.length === 0) {
    return "No issues found.";
  }

  const lines: string[] = [];
  lines.push(`Found ${issues.length} issue(s):`);
  lines.push("");
  lines.push(`  ${"Slug".padEnd(30)} ${"Status".padEnd(14)} ${"Project".padEnd(16)} Tags`);
  lines.push(`  ${"─".repeat(28)}  ${"─".repeat(12)}  ${"─".repeat(14)}  ─────`);

  for (const issue of issues) {
    lines.push(formatIssueRow(
      issue.slug,
      issue.frontmatter.status,
      issue.frontmatter.project,
      issue.frontmatter.tags,
    ));
  }

  return lines.join("\n");
}

function handleMove(args: string[], wikiDir: string): string {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {},
  });

  if (positionals.length < 2) {
    return err("Usage: issue move <slug> <status>");
  }

  const slug = positionals[0]!;
  const status = positionals[1]! as "backlog" | "in-progress" | "done";

  if (!["backlog", "in-progress", "done"].includes(status)) {
    return err(`Invalid status "${status}". Must be one of: backlog, in-progress, done`);
  }

  return safeRun(() => {
    moveIssue(wikiDir, slug, status);
    return `Moved issue: ${slug} → ${status}`;
  }, slug);
}

function handleBlock(args: string[], wikiDir: string): string {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      by: { type: "string" },
    },
  });

  const missingSlug = requireSlug(
    positionals,
    "Usage: issue block <slug> --by <blocker>",
  );
  if (missingSlug) return missingSlug;

  const slug = positionals[0]!;
  const blocker = values.by;

  if (!blocker) {
    return err("--by is required. Usage: issue block <slug> --by <blocker>");
  }

  return safeRun(() => {
    blockIssue(wikiDir, slug, blocker);
    return `Blocked issue: ${slug} is now blocked by [[${blocker}]]`;
  }, slug);
}

function handleClose(args: string[], wikiDir: string, rawDir: string): string {
  const { positionals, values } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      delete: { type: "boolean", default: false },
    },
  });

  const missingSlug = requireSlug(
    positionals,
    "Usage: issue close <slug> [--delete]",
  );
  if (missingSlug) return missingSlug;

  const slug = positionals[0]!;
  const shouldDelete = values.delete;

  return safeRun(() => {
    closeIssue(wikiDir, rawDir, slug, { delete: shouldDelete });
    if (shouldDelete) {
      return `Closed issue: ${slug} (deleted)`;
    }
    return `Closed issue: ${slug} (moved to inbox)`;
  }, slug);
}
