/**
 * Tab-aware whitespace fuzzy matching for the edit tool.
 *
 * Provides progressively relaxed whitespace matching:
 *   1. Exact match (must be unique)
 *   2. Tab-to-space normalization (preserves indentation structure)
 *   3. Content-only matching (strips all leading/trailing whitespace per line)
 */

type NormalizeFn = (line: string) => string;

/** Tier 2: tabs → spaces, trim trailing whitespace */
const tabNormalize: NormalizeFn = (line) => line.replace(/\t/g, "  ").trimEnd();

/** Tier 3: collapse all whitespace, trim both sides */
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
  let searchFrom = 0;
  const exactMatches: number[] = [];
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
    throw new Error(
      `Fuzzy whitespace matching found ${exactMatches.length} matches. ` +
        "Provide more surrounding context in oldText to make it unique.",
    );
  }

  // Tier 1: tab-to-space normalization
  const tier1 = lineFuzzyMatch(content, oldText, newText, tabNormalize);
  if (tier1.found) return tier1;

  // Tier 2: content-only matching
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
    throw new Error(
      `Fuzzy whitespace matching found ${matches.length} matches. ` +
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
