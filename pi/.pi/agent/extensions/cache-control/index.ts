import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Cache control marker format (Alibaba Cloud / Anthropic-compatible).
 */
const CACHE_CONTROL = { type: "ephemeral" } as const;

/**
 * Maximum cache_control markers per request.
 * Alibaba Cloud limits to 4; Anthropic also limits to 4.
 */
const MAX_MARKERS = 4;

/**
 * Model ID prefixes that need explicit cache_control injection.
 *
 * These are models where the upstream provider supports explicit caching
 * via `cache_control` markers, but pi's built-in code only handles
 * Anthropic models on OpenRouter.
 *
 * Without these markers, caching falls back to the provider's unreliable
 * implicit cache (e.g. Alibaba Cloud reports native_tokens_cached: 0).
 * Adding explicit markers ensures deterministic cache hits.
 *
 * Models are matched by prefix against the `model` field in the request
 * payload (e.g. "qwen/qwen3.6-plus" matches "qwen/").
 *
 * To add more models, append to this array.
 */
const CACHE_MODEL_PREFIXES = ["qwen/"];

export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", (event, _ctx) => {
    const payload = event.payload as Record<string, any>;
    if (!payload) return;

    const modelId = payload.model as string | undefined;
    if (!modelId) return;

    // Only inject for models that need explicit cache_control
    const needsCacheControl = CACHE_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
    if (!needsCacheControl) return;

    const messages = payload.messages as Array<Record<string, any>>;
    if (!Array.isArray(messages) || messages.length === 0) return;

    let markerCount = 0;

    // Strategy (Alibaba Cloud / Anthropic multi-turn caching):
    //
    // 1. Add cache_control to system/developer messages (static prefix).
    //    The system prompt is ~15k+ tokens and rarely changes — biggest
    //    caching win.
    //
    // 2. Add cache_control to the last message (growing conversation).
    //    This creates a rolling cache: each turn hits the previous turn's
    //    cache and creates a new one extending to the current position.
    //
    // Result:
    //   Turn 1: system cached (creation), full context cached (creation)
    //   Turn 2: system cache hit, previous context cache hit, new context cached
    //   Turn 3+: both caches keep being hit and refreshed (5-min TTL)

    // Marker 1: System/developer messages (static prefix)
    for (const msg of messages) {
      if (msg.role !== "system" && msg.role !== "developer") continue;
      if (markerCount >= MAX_MARKERS) break;
      addCacheControl(msg);
      markerCount++;
    }

    // Marker 2: Last message (covers the growing conversation prefix)
    if (markerCount < MAX_MARKERS && messages.length > 0) {
      addCacheControl(messages[messages.length - 1]);
      markerCount++;
    }

    return payload;
  });
}

/**
 * Add a `cache_control` marker to a message's content.
 *
 * - String content → convert to array with marker on the single text block.
 * - Array content → add marker to the last content block (if not already set).
 *
 * This follows the format expected by Alibaba Cloud and Anthropic:
 *   `{ "type": "text", "text": "...", "cache_control": { "type": "ephemeral" } }`
 */
export function addCacheControl(msg: Record<string, any>): void {
  if (typeof msg.content === "string") {
    msg.content = [
      {
        type: "text",
        text: msg.content,
        cache_control: CACHE_CONTROL,
      },
    ];
  } else if (Array.isArray(msg.content) && msg.content.length > 0) {
    const lastBlock = msg.content[msg.content.length - 1];
    if (!lastBlock.cache_control) {
      lastBlock.cache_control = CACHE_CONTROL;
    }
  }
}
