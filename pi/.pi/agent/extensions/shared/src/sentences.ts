/**
 * Sentence parsing utilities for subagent output.
 *
 * When subagents return unstructured output (e.g., concatenated thinking),
 * this module splits it into readable sentence fragments for display.
 */

/** A parsed sentence fragment with metadata */
export interface SentenceFragment {
  /** The sentence text, trimmed */
  text: string;
  /** Whether this was truncated to fit max length */
  truncated: boolean;
}

/**
 * Split unstructured text into sentence fragments.
 *
 * Handles:
 * - Standard sentence boundaries (`. `, `! `, `? `)
 * - Colon-separated thoughts (common in agent thinking)
 * - Filters out very short fragments
 * - Truncates long sentences
 *
 * @param text - The unstructured text to split
 * @param options - Configuration options
 * @returns Array of sentence fragments
 */
export function splitIntoSentences(
  text: string,
  options: {
    /** Maximum length per sentence before truncation (default: 80) */
    maxLength?: number;
    /** Minimum length to include a fragment (default: 15) */
    minLength?: number;
  } = {},
): SentenceFragment[] {
  const { maxLength = 80, minLength = 15 } = options;

  // Split on sentence endings followed by capital letter, or on colon + space
  // This handles "Let me check. Now I see", "check: also see", and "there.Now" (no space after period)
  const rawFragments = text
    .split(/(?<=[.!?])\s*(?=[A-Z])|:\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= minLength);

  return rawFragments.map((fragment) => {
    if (fragment.length > maxLength) {
      return {
        text: `${fragment.slice(0, maxLength - 3)}...`,
        truncated: true,
      };
    }
    return { text: fragment, truncated: false };
  });
}

/**
 * Format sentence fragments as a bullet list string.
 *
 * @param fragments - The sentence fragments to format
 * @param options - Configuration options
 * @returns Formatted string with bullet points
 */
export function formatAsBulletList(
  fragments: SentenceFragment[],
  options: {
    /** Maximum number of items to show (default: 4) */
    maxItems?: number;
    /** Bullet character (default: "•") */
    bullet?: string;
  } = {},
): string {
  const { maxItems = 4, bullet = "•" } = options;

  if (fragments.length === 0) {
    return "";
  }

  const items = fragments.slice(0, maxItems);
  let result = items.map((f) => `  ${bullet} ${f.text}`).join("\n");

  if (fragments.length > maxItems) {
    result += `\n  ... +${fragments.length - maxItems} more`;
  }

  return result;
}
