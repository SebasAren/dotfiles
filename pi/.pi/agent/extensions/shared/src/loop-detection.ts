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
 * 2 *different* tools. A run of identical tools (e.g. grep, grep, grep)
 * with the same args is handled by the consecutive-call check below,
 * and that requires 4+ identical calls before flagging.
 */
export function detectLoop(
  toolHistory: Array<{ name: string; argsSignature: string }>,
  windowSize: number = 8,
): string | null {
  const recent = toolHistory.slice(-windowSize);
  if (recent.length < 4) return null;

  // Check for repeated subsequences of length 2+ (A,B,A,B pattern)
  // Only flag when the subsequence contains at least 2 distinct tools —
  // homogeneous sequences like (grep, grep, grep) are not real loops.
  for (let seqLen = 2; seqLen <= Math.floor(recent.length / 2); seqLen++) {
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
        // Require at least 2 distinct tools in the subsequence
        const uniqueTools = new Set(second.map((t) => t.name));
        if (uniqueTools.size < 2) continue;

        const toolNames = second.map((t) => t.name).join(", ");
        return `Loop detected: ${seqLen}-tool sequence repeated (${toolNames})`;
      }
    }
  }

  // Check for 4+ identical consecutive calls (raised from 3 to avoid
  // false positives when the agent legitimately runs several greps)
  const lastSig = recent[recent.length - 1];
  let identicalCount = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].name === lastSig.name && recent[i].argsSignature === lastSig.argsSignature) {
      identicalCount++;
    } else {
      break;
    }
  }
  if (identicalCount >= 4) {
    return `Loop detected: ${lastSig.name} called ${identicalCount} times with same args`;
  }

  return null;
}
