/**
 * Tab-aware whitespace fuzzy matching for the edit tool.
 *
 * Provides progressively relaxed whitespace matching:
 *   1. Exact match (must be unique)
 *   2. Tab-to-space normalization (preserves indentation structure)
 *   3. Indent-shift (allows a consistent leading-whitespace offset)
 *   4. Content-only matching (strips all leading/trailing whitespace per line)
 */

type NormalizeFn = (line: string) => string;

/** Tier 2: tabs → spaces, trim trailing whitespace */
const tabNormalize: NormalizeFn = (line) => line.replace(/\t/g, "  ").trimEnd();

/** Tier 4: collapse all whitespace, trim both sides */
const contentNormalize: NormalizeFn = (line) => line.replace(/\s+/g, " ").trim();

export interface FuzzyResult {
  content: string;
  found: boolean;
  fuzzy: boolean;
}

/**
 * Try to find and replace oldText in content with progressively relaxed
 * whitespace normalization. Returns the modified content and whether fuzzy
 * matching was used.
 */
export function tabFuzzyReplace(content: string, oldText: string, newText: string): FuzzyResult {
  // Tier 0: exact match (must be unique)
  const exactMatches: number[] = [];
  let searchFrom = 0;
  let idx: number;
  while ((idx = content.indexOf(oldText, searchFrom)) !== -1) {
    exactMatches.push(idx);
    searchFrom = idx + 1;
  }
  if (exactMatches.length === 1) {
    const exactIdx = exactMatches[0];
    return {
      content: content.slice(0, exactIdx) + newText + content.slice(exactIdx + oldText.length),
      found: true,
      fuzzy: false,
    };
  }
  if (exactMatches.length > 1) {
    const lineNums = exactMatches.map((i) => content.slice(0, i).split("\n").length);
    throw new Error(
      `Fuzzy whitespace matching found ${exactMatches.length} matches at line(s) ${lineNums.join(", ")}. ` +
        "Provide more surrounding context in oldText to make it unique.",
    );
  }

  // Tier 1: tab-to-space normalization
  const tier1 = lineFuzzyMatch(content, oldText, newText, tabNormalize);
  if (tier1.found) return tier1;

  // Tier 2: indent-shift (uniform leading-whitespace offset)
  const tier2 = indentShiftMatch(content, oldText, newText);
  if (tier2.found) return tier2;

  // Tier 3: content-only matching
  return lineFuzzyMatch(content, oldText, newText, contentNormalize);
}

/**
 * Line-based fuzzy matching. Normalizes each line of both content and oldText,
 * finds the matching line range, and replaces those lines with newText lines.
 * Requires exactly one match (unique).
 */
export function lineFuzzyMatch(
  content: string,
  oldText: string,
  newText: string,
  normalize: NormalizeFn,
): FuzzyResult {
  const contentLines = content.replace(/\n+$/, "").split("\n");
  const searchLines = oldText.replace(/\n+$/, "").split("\n");
  if (searchLines.length === 0) return { content, found: false, fuzzy: false };

  const normalizedSearch = searchLines.map(normalize);

  // Find all matching positions
  const matches: number[] = [];
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    let match = true;
    for (let j = 0; j < searchLines.length; j++) {
      if (normalize(contentLines[i + j]) !== normalizedSearch[j]) {
        match = false;
        break;
      }
    }
    if (match) matches.push(i);
  }

  if (matches.length === 0) return { content, found: false, fuzzy: false };

  if (matches.length > 1) {
    const lineNums = matches.map((i) => i + 1);
    throw new Error(
      `Fuzzy whitespace matching found ${matches.length} matches at line(s) ${lineNums.join(", ")}. ` +
        "Provide more surrounding context in oldText to make it unique.",
    );
  }

  // Apply the single match — replace matched lines with newText lines
  const startLine = matches[0];
  const newLines = newText.split("\n");
  const result = [
    ...contentLines.slice(0, startLine),
    ...newLines,
    ...contentLines.slice(startLine + searchLines.length),
  ];

  return { content: result.join("\n"), found: true, fuzzy: true };
}

/** Leading-whitespace width of a line (tabs count as 2, matching tabNormalize). */
function leadingWidth(line: string): number {
  const normalized = line.replace(/\t/g, "  ");
  return normalized.length - normalized.trimStart().length;
}

/** Minimum leading-whitespace width across non-blank lines. */
function getMinIndent(lines: string[]): number {
  let min = Infinity;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const width = leadingWidth(line);
    if (width < min) min = width;
  }
  return min === Infinity ? 0 : min;
}

/**
 * Match oldText against content when both differ only by a consistent
 * leading-whitespace offset. On a unique match, apply newText with the offset
 * added (or removed) from each line so the replacement sits at the file's
 * indent depth.
 */
export function indentShiftMatch(content: string, oldText: string, newText: string): FuzzyResult {
  const contentLines = content.replace(/\n+$/, "").split("\n");
  const searchLines = oldText.replace(/\n+$/, "").split("\n");
  if (searchLines.length === 0) return { content, found: false, fuzzy: false };

  const normSearch = searchLines.map(tabNormalize);
  const searchMinIndent = getMinIndent(normSearch);
  const dedentSearch = normSearch.map((l) => (l.trim() === "" ? "" : l.slice(searchMinIndent)));

  const matches: Array<{ start: number; fileIndent: number }> = [];
  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const normBlock = contentLines.slice(i, i + searchLines.length).map(tabNormalize);
    const fileMinIndent = getMinIndent(normBlock);
    if (fileMinIndent === searchMinIndent) continue; // pure-indent shift only
    const dedentBlock = normBlock.map((l) => (l.trim() === "" ? "" : l.slice(fileMinIndent)));
    let match = true;
    for (let j = 0; j < dedentBlock.length; j++) {
      if (dedentBlock[j] !== dedentSearch[j]) {
        match = false;
        break;
      }
    }
    if (match) matches.push({ start: i, fileIndent: fileMinIndent });
  }

  if (matches.length === 0) return { content, found: false, fuzzy: false };
  if (matches.length > 1) {
    const lineNums = matches.map((m) => m.start + 1);
    throw new Error(
      `Indent-shift fuzzy matching found ${matches.length} matches at line(s) ${lineNums.join(", ")}. ` +
        "Provide more surrounding context in oldText to make it unique.",
    );
  }

  const { start, fileIndent } = matches[0];
  const delta = fileIndent - searchMinIndent;
  const newLines = newText.split("\n").map((line) => {
    if (line === "") return line;
    if (delta > 0) return " ".repeat(delta) + line;
    if (delta < 0) return line.replace(new RegExp(`^ {0,${-delta}}`), "");
    return line;
  });

  const result = [
    ...contentLines.slice(0, start),
    ...newLines,
    ...contentLines.slice(start + searchLines.length),
  ];
  return { content: result.join("\n"), found: true, fuzzy: true };
}
