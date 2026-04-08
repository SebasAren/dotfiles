/**
 * Loop detection utilities for subagent tool calls.
 *
 * Prevents subagents from getting stuck in repetitive tool call patterns
 * by tracking recent call signatures and detecting repeated subsequences.
 */

/**
 * Creates a normalized signature from tool args to detect near-duplicates.
 * Normalizes paths and trims long values.
 */
export function argsSignature(args: Record<string, unknown>): string {
  const entries = Object.entries(args)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      // Normalize paths: strip trailing slashes, resolve ./ prefixes
      const normalized = s.replace(/\/+$/, "").replace(/^\.\//, "");
      // Truncate long values to avoid false negatives from minor differences
      return `${k}:${normalized.length > 100 ? normalized.slice(0, 100) + "..." : normalized}`;
    });
  return entries.join("|");
}

/**
 * Detects loops by tracking recent tool call signatures.
 * Returns a description of the loop if detected, or null otherwise.
 *
 * We only flag repeated subsequences when the sequence contains at least
 * 4 *different* tools. A run of identical tools (e.g. grep, grep, grep)
 * with the same args is handled by the consecutive-call check below,
 * and that requires 6+ identical calls before flagging.
 *
 * Thresholds are intentionally conservative — exploration agents legitimately
 * repeat tool patterns (grep, grep, find, grep, grep, find) when broadening
 * searches. Only flag clear, sustained loops.
 */
export function detectLoop(
  toolHistory: Array<{ name: string; argsSignature: string }>,
  windowSize: number = 12,
): string | null {
  const recent = toolHistory.slice(-windowSize);

  // Check for 6+ identical consecutive calls — always a loop regardless of
  // total history size. Increased from 4 to allow exploration agents to
  // retry searches with slight variations.
  if (recent.length >= 6) {
    const lastSig = recent[recent.length - 1];
    let identicalCount = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].name === lastSig.name && recent[i].argsSignature === lastSig.argsSignature) {
        identicalCount++;
      } else {
        break;
      }
    }
    if (identicalCount >= 6) {
      return `Loop detected: ${lastSig.name} called ${identicalCount} times with same args`;
    }
  }

  if (recent.length < 8) return null;

  // Check for repeated subsequences of length 4+ (A,B,C,D,A,B,C,D pattern).
  // Length-2 and 3 subsequences are too common during normal exploration
  // and cause false positives during search broadening.
  for (let seqLen = 4; seqLen <= Math.floor(recent.length / 2); seqLen++) {
    const first = recent.slice(-seqLen * 2, -seqLen);
    const second = recent.slice(-seqLen);
    if (first.length === seqLen && second.length === seqLen) {
      let match = true;
      for (let i = 0; i < seqLen; i++) {
        if (
          first[i].name !== second[i].name ||
          first[i].argsSignature !== second[i].argsSignature
        ) {
          match = false;
          break;
        }
      }
      if (match) {
        // Require at least 4 distinct tools in the subsequence.
        // 2-3 tool mixes like (grep, grep, grep, find) are too common
        // during legitimate search broadening.
        const uniqueTools = new Set(second.map((t) => t.name));
        if (uniqueTools.size < 4) continue;

        const toolNames = second.map((t) => t.name).join(", ");
        return `Loop detected: ${seqLen}-tool sequence repeated (${toolNames})`;
      }
    }
  }

  return null;
}
