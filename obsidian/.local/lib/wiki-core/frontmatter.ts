export interface IssueFrontmatter {
  type: "issue";
  status: "backlog" | "in-progress" | "done";
  tags: string[];
  created: string;
  project: string;
  "blocked-by"?: string;
}

const VALID_STATUSES = new Set(["backlog", "in-progress", "done"]);
const KNOWN_KEYS = new Set([
  "type",
  "status",
  "tags",
  "created",
  "project",
  "blocked-by",
]);

/**
 * Parse a markdown string with YAML frontmatter.
 * Returns the parsed frontmatter and the body (content after frontmatter).
 * Throws if frontmatter is missing, invalid, or fails schema validation.
 */
export function parseFrontmatter(
  markdown: string,
): { frontmatter: IssueFrontmatter; body: string } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Missing YAML frontmatter delimiters (---)");
  }

  const parsed = parseFlatYaml(match[1]);
  const frontmatter = validateIssueFrontmatter(parsed);
  const body = match[2];

  return { frontmatter, body };
}

/**
 * Serialize frontmatter and body back to markdown with YAML frontmatter.
 */
export function stringifyFrontmatter(
  frontmatter: IssueFrontmatter,
  body: string,
): string {
  const lines: string[] = [];

  lines.push(`type: ${frontmatter.type}`);
  lines.push(`status: ${frontmatter.status}`);
  lines.push(`tags: ${stringifyArray(frontmatter.tags)}`);
  lines.push(`created: ${frontmatter.created}`);
  lines.push(`project: ${quoteIfNeeded(frontmatter.project)}`);
  if (frontmatter["blocked-by"] !== undefined) {
    lines.push(`blocked-by: ${quoteIfNeeded(frontmatter["blocked-by"])}`);
  }

  return `---\n${lines.join("\n")}\n---\n${body}`;
}

// ── Internal: flat YAML parser ──

function parseFlatYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([^\s:]+):\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    const raw = match[2].trim();

    result[key] = parseValue(raw);
  }

  return result;
}

function parseValue(raw: string): unknown {
  if (raw === "") return "";

  // Quoted strings
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }

  // Inline array
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return parseInlineArray(raw);
  }

  // Booleans
  if (raw === "true") return true;
  if (raw === "false") return false;

  // Numbers
  if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  if (/^\d+\.\d+$/.test(raw)) return parseFloat(raw, 10);

  // Plain string
  return raw;
}

function parseInlineArray(raw: string): unknown[] {
  const inner = raw.slice(1, -1).trim();
  if (inner === "") return [];

  const items: unknown[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];

    if (inQuote) {
      current += ch;
      if (ch === quoteChar) {
        inQuote = false;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === ",") {
      items.push(parseValue(current.trim()));
      current = "";
    } else {
      current += ch;
    }
  }

  if (current.trim() !== "") {
    items.push(parseValue(current.trim()));
  }

  return items;
}

// ── Internal: validation ──

function validateIssueFrontmatter(
  parsed: Record<string, unknown>,
): IssueFrontmatter {
  // Reject unknown keys
  for (const key of Object.keys(parsed)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new Error(`Unknown frontmatter key: "${key}"`);
    }
  }

  // Required fields
  if (parsed.type !== "issue") {
    throw new Error(
      `Invalid type: expected "issue", got ${JSON.stringify(parsed.type)}`,
    );
  }

  if (typeof parsed.status !== "string" || !VALID_STATUSES.has(parsed.status)) {
    throw new Error(
      `Invalid status: expected one of ${[...VALID_STATUSES].join(", ")}, got ${JSON.stringify(parsed.status)}`,
    );
  }

  if (!Array.isArray(parsed.tags) || !parsed.tags.every((t) => typeof t === "string")) {
    throw new Error(
      `Invalid tags: expected string[], got ${JSON.stringify(parsed.tags)}`,
    );
  }

  if (typeof parsed.created !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.created)) {
    throw new Error(
      `Invalid created: expected ISO date string (YYYY-MM-DD), got ${JSON.stringify(parsed.created)}`,
    );
  }

  if (typeof parsed.project !== "string" || parsed.project === "") {
    throw new Error(
      `Invalid project: expected non-empty string, got ${JSON.stringify(parsed.project)}`,
    );
  }

  // Optional field
  if (parsed["blocked-by"] !== undefined && typeof parsed["blocked-by"] !== "string") {
    throw new Error(
      `Invalid blocked-by: expected string, got ${JSON.stringify(parsed["blocked-by"])}`,
    );
  }

  return parsed as unknown as IssueFrontmatter;
}

// ── Internal: serialization helpers ──

function stringifyArray(items: string[]): string {
  const parts = items.map((item) => {
    if (item.includes(",") || item.includes(" ") || item.includes('"')) {
      return `"${item.replace(/"/g, '\\"')}"`;
    }
    return item;
  });
  return `[${parts.join(", ")}]`;
}

function quoteIfNeeded(value: string): string {
  if (
    value.includes(":") ||
    value.includes("#") ||
    value.includes("[") ||
    value.includes("]") ||
    value.includes('"') ||
    value === ""
  ) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}
