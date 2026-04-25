import type { SessionEntry } from "@mariozechner/pi-coding-agent";

/**
 * Walk session entries (leaf-to-root) and extract the text content
 * from the first (most recent) assistant message found.
 *
 * Only extracts `type: "text"` content blocks — thinking content and
 * tool calls are ignored.
 *
 * Returns null if no assistant message is found.
 */
export function getLastAssistantMessage(entries: SessionEntry[]): string | null {
  // getBranch() returns entries root-to-leaf (oldest first),
  // so walk backwards to find the most recent assistant message.
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type !== "message") continue;
    if (entry.message.role !== "assistant") continue;

    const textBlocks = entry.message.content.filter(
      (block): block is { type: "text"; text: string } => block.type === "text",
    );

    if (textBlocks.length === 0) continue; // keep looking at older assistant messages

    return textBlocks.map((b) => b.text).join("\n");
  }

  return null;
}
