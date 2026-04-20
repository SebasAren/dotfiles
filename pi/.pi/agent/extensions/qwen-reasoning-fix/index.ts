import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Workaround for pi-ai not extracting `reasoning.text` entries from
 * OpenRouter's `reasoning_details` array (only `reasoning.encrypted` is
 * handled upstream). Qwen3.x models emit reasoning exclusively via
 * `reasoning_details`, so without this shim the stream assembles zero
 * content blocks and the turn appears to "stop in thinking".
 *
 * This is a response-side fix. Since pi extensions only have
 * `before_provider_request` (request-side), we intercept `globalThis.fetch`
 * and wrap SSE response bodies from openrouter.ai. Each `data: {json}` line
 * is inspected; if `choices[].delta.reasoning_details` contains text entries
 * and no standard reasoning field is set, we mirror the concatenated text
 * into `reasoning_content` so pi-ai's existing parser picks it up.
 *
 * Mirrors openclaw PR #66905, which fixed the same bug in their fork.
 */

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

const QWEN_MODEL_PREFIX = "qwen/";

let installed = false;

export default function (pi: ExtensionAPI) {
  if (!installed) {
    installed = true;
    const origFetch = globalThis.fetch.bind(globalThis);
    const patchedFetch = async (input: FetchInput, init?: FetchInit): Promise<Response> => {
      const response = await origFetch(input, init);
      if (!shouldTransform(input, response)) return response;
      return transformSSEResponse(response);
    };
    globalThis.fetch = patchedFetch as typeof fetch;
  }

  pi.on("before_provider_request", (event, _ctx) => {
    const payload = event.payload as Record<string, any> | undefined;
    if (!payload) return;
    const modelId = payload.model;
    if (typeof modelId !== "string" || !modelId.startsWith(QWEN_MODEL_PREFIX)) return;
    const messages = payload.messages;
    if (!Array.isArray(messages)) return;
    let modified = false;
    for (const msg of messages) {
      if (convertReasoningToDetails(msg)) modified = true;
    }
    return modified ? payload : undefined;
  });
}

function extractUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function shouldTransform(input: FetchInput, response: Response): boolean {
  const url = extractUrl(input);
  if (!url.includes("openrouter.ai")) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) return false;
  return response.body !== null;
}

export function transformSSEResponse(response: Response): Response {
  const upstream = response.body!;
  const transformed = transformSSEStream(upstream);
  return new Response(transformed, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

/**
 * Wrap a ReadableStream of SSE bytes, transforming each `data:` line via
 * `transformSSELine`. Non-data lines and inter-event blank lines pass through
 * unchanged. A final partial line (if any) is flushed at stream close.
 */
export function transformSSEStream(
  upstream: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.length > 0) {
              controller.enqueue(encoder.encode(transformSSELine(buffer)));
            }
            controller.close();
            return;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            controller.enqueue(encoder.encode(transformSSELine(line) + "\n"));
          }
        }
      } catch (e) {
        controller.error(e);
      }
    },
    async cancel(reason) {
      // Forward downstream cancellation upstream so the underlying fetch
      // connection is released instead of lingering until the server closes.
      await reader?.cancel(reason);
    },
  });
}

/**
 * Given one SSE line, return the (possibly modified) line.
 * - Non-`data:` lines are returned unchanged.
 * - `[DONE]` and empty payloads are returned unchanged.
 * - Malformed JSON is passed through.
 * - If any `choices[i].delta.reasoning_details` entry has `type !== "reasoning.encrypted"`
 *   and a string `text` field, concatenate those texts and set
 *   `choices[i].delta.reasoning_content` — but only if no reasoning field
 *   is already populated on that delta.
 */
export function transformSSELine(line: string): string {
  const hasCr = line.endsWith("\r");
  const stripped = hasCr ? line.slice(0, -1) : line;
  if (!stripped.startsWith("data:")) return line;

  const payload = stripped.slice(5).trimStart();
  if (payload.length === 0 || payload === "[DONE]") return line;

  let event: any;
  try {
    event = JSON.parse(payload);
  } catch {
    return line;
  }

  if (!event || !Array.isArray(event.choices)) return line;

  let modified = false;
  for (const choice of event.choices) {
    const delta = choice?.delta;
    if (!delta) continue;
    const details = delta.reasoning_details;
    if (!Array.isArray(details) || details.length === 0) continue;

    const text = details
      .filter(
        (d: any) =>
          d &&
          typeof d.type === "string" &&
          d.type !== "reasoning.encrypted" &&
          typeof d.text === "string" &&
          d.text.length > 0,
      )
      .map((d: any) => d.text)
      .join("");
    if (text.length === 0) continue;

    const alreadySet =
      (typeof delta.reasoning_content === "string" && delta.reasoning_content.length > 0) ||
      (typeof delta.reasoning === "string" && delta.reasoning.length > 0) ||
      (typeof delta.reasoning_text === "string" && delta.reasoning_text.length > 0);
    if (alreadySet) continue;

    delta.reasoning_content = text;
    modified = true;
  }

  if (!modified) return line;
  return "data: " + JSON.stringify(event) + (hasCr ? "\r" : "");
}

/**
 * Request-side counterpart to the SSE response transform.
 *
 * pi-ai serialises a prior turn's thinking as a top-level string field on the
 * assistant message (e.g. `reasoning_content: "..."`) — the field name is
 * whatever `thinkingSignature` was captured during streaming. OpenRouter/Qwen
 * expect reasoning to be passed back as a structured `reasoning_details`
 * array to preserve chain-of-thought across turns; a plain string gets
 * dropped on the provider side.
 *
 * For a qwen assistant message, this moves the string into a
 * `{type: "reasoning.text", text}` entry in `reasoning_details`. Any existing
 * entries (e.g. `reasoning.encrypted` from tool calls) are kept — the new
 * text entry is prepended, since pi-ai appends encrypted entries after
 * text reasoning in the streamed response order.
 *
 * Returns true if the message was modified.
 */
export function convertReasoningToDetails(msg: Record<string, any>): boolean {
  if (!msg || msg.role !== "assistant") return false;
  const stringFields = ["reasoning_content", "reasoning", "reasoning_text"] as const;
  let extracted = "";
  let touched = false;
  for (const field of stringFields) {
    const value = msg[field];
    if (typeof value === "string" && value.length > 0) {
      if (extracted.length > 0) extracted += "\n";
      extracted += value;
      touched = true;
    }
    if (field in msg) {
      delete msg[field];
      touched = true;
    }
  }
  if (extracted.length === 0) return touched;
  const existing = Array.isArray(msg.reasoning_details) ? msg.reasoning_details : [];
  msg.reasoning_details = [{ type: "reasoning.text", text: extracted }, ...existing];
  return true;
}
