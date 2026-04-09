/**
 * Loop detection utilities for subagent tool calls.
 *
 * Prevents subagents from getting stuck in repetitive tool call patterns
 * by tracking recent call signatures and detecting repeated subsequences.
 */

/** Severity of a detected loop. */
export type LoopSeverity = "warn" | "kill";

/** Result from loop detection. */
export interface LoopResult {
  severity: LoopSeverity;
  message: string;
}

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
      const truncated = normalized.length > 100 ? normalized.slice(0, 100) + "..." : normalized;
      return `${k}:${truncated}`;
    });
  return entries.join("|");
}

/**
 * Detects loops by tracking recent tool call signatures.
 * Returns a LoopResult if a loop is detected, or null otherwise.
 *
 * Two severity levels:
 * - "warn": early sign of a loop (2 consecutive identical calls).
 *   Caller should send a steering message to break the pattern.
 * - "kill": clear loop (3 consecutive identical calls). Caller should
 *   terminate the subagent.
 *
 * We only flag repeated subsequences when the sequence contains at least
 * 4 *different* tools. A run of identical tools (e.g. grep, grep, grep)
 * with the same args is handled by the consecutive-call check.
 *
 * Thresholds are intentionally conservative — exploration agents legitimately
 * repeat tool patterns (grep, grep, find, grep, grep, find) when broadening
 * searches. Only flag clear, sustained loops.
 */
export function detectLoop(
  toolHistory: Array<{ name: string; argsSignature: string }>,
  windowSize: number = 12,
): LoopResult | null {
  const recent = toolHistory.slice(-windowSize);

  // Check for consecutive identical calls.
  // Kill at 3+, warn at 2. Reading the same file 2+ times in a row with
  // identical args is always a loop — legitimate exploration never does this.
  if (recent.length >= 2) {
    const lastSig = recent[recent.length - 1];
    let identicalCount = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      if (recent[i].name === lastSig.name && recent[i].argsSignature === lastSig.argsSignature) {
        identicalCount++;
      } else {
        break;
      }
    }
    if (identicalCount >= 3) {
      return {
        severity: "kill",
        message: `Loop detected: ${lastSig.name} called ${identicalCount} times with same args`,
      };
    }
    if (identicalCount >= 2) {
      return {
        severity: "warn",
        message: `${lastSig.name} called ${identicalCount} times with same args — change your approach`,
      };
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
        return {
          severity: "kill",
          message: `Loop detected: ${seqLen}-tool sequence repeated (${toolNames})`,
        };
      }
    }
  }

  return null;
}
