import { describe, it, expect, mock } from "bun:test";
import { piCodingAgentMock, typeboxMock } from "../shared/src/test-mocks";

mock.module("@mariozechner/pi-coding-agent", piCodingAgentMock);
mock.module("@sinclair/typebox", typeboxMock);

import qwenReasoningFix, {
  transformSSELine,
  transformSSEStream,
  transformSSEResponse,
  convertReasoningToDetails,
} from "./index";

describe("qwen-reasoning-fix extension factory", () => {
  it("can be loaded without errors", () => {
    const mockApi = { on: mock(() => {}) };
    expect(() => qwenReasoningFix(mockApi as any)).not.toThrow();
  });

  it("registers a before_provider_request handler", () => {
    const handlers: Record<string, Function> = {};
    const mockApi = {
      on: mock((event: string, h: Function) => {
        handlers[event] = h;
      }),
    };
    qwenReasoningFix(mockApi as any);
    expect(handlers["before_provider_request"]).toBeDefined();
  });
});

describe("before_provider_request handler", () => {
  function getHandler() {
    const handlers: Record<string, Function> = {};
    const mockApi = {
      on: mock((event: string, h: Function) => {
        handlers[event] = h;
      }),
    };
    qwenReasoningFix(mockApi as any);
    return handlers["before_provider_request"];
  }

  it("converts reasoning_content to reasoning_details for qwen models", () => {
    const handler = getHandler();
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello", reasoning_content: "thought process" },
      ],
    };
    const result = handler({ payload }, {});
    expect(result).toBe(payload);
    const assistantMsg = payload.messages[1] as any;
    expect(assistantMsg.reasoning_content).toBeUndefined();
    expect(assistantMsg.reasoning_details).toEqual([
      { type: "reasoning.text", text: "thought process" },
    ]);
  });

  it("leaves non-qwen models untouched", () => {
    const handler = getHandler();
    const payload = {
      model: "anthropic/claude-sonnet-4",
      messages: [{ role: "assistant", content: "hello", reasoning_content: "thought process" }],
    };
    const result = handler({ payload }, {});
    expect(result).toBeUndefined();
    expect((payload.messages[0] as any).reasoning_content).toBe("thought process");
  });

  it("prepends text before existing encrypted entries", () => {
    const handler = getHandler();
    const encrypted = { type: "reasoning.encrypted", id: "tc_1", data: "blob" };
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        {
          role: "assistant",
          content: "hello",
          reasoning_content: "thought",
          reasoning_details: [encrypted],
        },
      ],
    };
    handler({ payload }, {});
    const assistantMsg = payload.messages[0] as any;
    expect(assistantMsg.reasoning_details).toEqual([
      { type: "reasoning.text", text: "thought" },
      encrypted,
    ]);
  });

  it("also handles `reasoning` and `reasoning_text` aliases", () => {
    const handler = getHandler();
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [{ role: "assistant", content: "hi", reasoning: "thought" }],
    };
    handler({ payload }, {});
    const assistantMsg = payload.messages[0] as any;
    expect(assistantMsg.reasoning).toBeUndefined();
    expect(assistantMsg.reasoning_details).toEqual([{ type: "reasoning.text", text: "thought" }]);
  });

  it("leaves assistant messages without reasoning alone", () => {
    const handler = getHandler();
    const payload = {
      model: "qwen/qwen3.6-plus",
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    };
    const result = handler({ payload }, {});
    expect(result).toBeUndefined();
  });

  it("ignores payload without model or messages", () => {
    const handler = getHandler();
    expect(handler({ payload: {} }, {})).toBeUndefined();
    expect(handler({ payload: { model: "qwen/x" } }, {})).toBeUndefined();
  });
});

describe("convertReasoningToDetails", () => {
  it("returns false when the message has no reasoning fields", () => {
    const msg: any = { role: "assistant", content: "hi" };
    expect(convertReasoningToDetails(msg)).toBe(false);
    expect(msg.reasoning_details).toBeUndefined();
  });

  it("ignores non-assistant roles", () => {
    const msg: any = { role: "user", content: "hi", reasoning_content: "x" };
    expect(convertReasoningToDetails(msg)).toBe(false);
    expect(msg.reasoning_content).toBe("x");
  });

  it("joins multiple reasoning fields with newline", () => {
    const msg: any = {
      role: "assistant",
      content: "hi",
      reasoning_content: "a",
      reasoning_text: "b",
    };
    convertReasoningToDetails(msg);
    expect(msg.reasoning_details).toEqual([{ type: "reasoning.text", text: "a\nb" }]);
  });

  it("deletes empty-string reasoning fields without creating an empty entry", () => {
    const msg: any = { role: "assistant", content: "hi", reasoning_content: "" };
    convertReasoningToDetails(msg);
    expect(msg).not.toHaveProperty("reasoning_content");
    expect(msg.reasoning_details).toBeUndefined();
  });
});

describe("transformSSELine", () => {
  it("mirrors reasoning_details[].text into reasoning_content", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"Let me think..."}]}}]}';
    const out = transformSSELine(input);
    const event = JSON.parse(out.slice(5));
    expect(event.choices[0].delta.reasoning_content).toBe("Let me think...");
    // Original reasoning_details is preserved
    expect(event.choices[0].delta.reasoning_details).toHaveLength(1);
  });

  it("concatenates multiple reasoning.text entries in order", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[' +
      '{"type":"reasoning.text","text":"Part A "},' +
      '{"type":"reasoning.text","text":"Part B"}' +
      "]}}]}";
    const out = transformSSELine(input);
    const event = JSON.parse(out.slice(5));
    expect(event.choices[0].delta.reasoning_content).toBe("Part A Part B");
  });

  it("ignores reasoning.encrypted entries (pi-ai handles those)", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[' +
      '{"type":"reasoning.encrypted","id":"tc_1","data":"encrypted-blob"}' +
      "]}}]}";
    const out = transformSSELine(input);
    expect(out).toBe(input);
  });

  it("extracts text from mixed entries but skips encrypted", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[' +
      '{"type":"reasoning.text","text":"visible"},' +
      '{"type":"reasoning.encrypted","id":"tc_1","data":"blob"}' +
      "]}}]}";
    const out = transformSSELine(input);
    const event = JSON.parse(out.slice(5));
    expect(event.choices[0].delta.reasoning_content).toBe("visible");
  });

  it("does not overwrite an existing reasoning_content", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_content":"already here","reasoning_details":[{"type":"reasoning.text","text":"other"}]}}]}';
    const out = transformSSELine(input);
    expect(out).toBe(input);
  });

  it("does not overwrite an existing reasoning field", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning":"already here","reasoning_details":[{"type":"reasoning.text","text":"other"}]}}]}';
    const out = transformSSELine(input);
    expect(out).toBe(input);
  });

  it("passes through the [DONE] sentinel", () => {
    expect(transformSSELine("data: [DONE]")).toBe("data: [DONE]");
  });

  it("passes through blank and non-data lines", () => {
    expect(transformSSELine("")).toBe("");
    expect(transformSSELine(":ping")).toBe(":ping");
    expect(transformSSELine("event: message")).toBe("event: message");
  });

  it("passes through malformed JSON", () => {
    const input = "data: {not valid json";
    expect(transformSSELine(input)).toBe(input);
  });

  it("passes through events without choices", () => {
    const input = 'data: {"id":"x","object":"chat.completion.chunk"}';
    expect(transformSSELine(input)).toBe(input);
  });

  it("passes through deltas without reasoning_details", () => {
    const input = 'data: {"choices":[{"delta":{"content":"hello"}}]}';
    expect(transformSSELine(input)).toBe(input);
  });

  it("preserves trailing \\r when present (CRLF streams)", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"x"}]}}]}\r';
    const out = transformSSELine(input);
    expect(out.endsWith("\r")).toBe(true);
    const json = out.slice(5, -1);
    expect(JSON.parse(json).choices[0].delta.reasoning_content).toBe("x");
  });

  it("skips entries without a text field", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","index":0}]}}]}';
    const out = transformSSELine(input);
    expect(out).toBe(input);
  });

  it("skips entries with empty text", () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":""}]}}]}';
    const out = transformSSELine(input);
    expect(out).toBe(input);
  });
});

describe("transformSSEStream", () => {
  async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
  }

  function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(encoder.encode(c));
        controller.close();
      },
    });
  }

  it("transforms a full SSE response with blank-line event separators", async () => {
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"thinking..."}]}}]}\n' +
      "\n" +
      'data: {"choices":[{"delta":{"content":"answer"}}]}\n' +
      "\n" +
      "data: [DONE]\n\n";
    const out = await drain(transformSSEStream(streamOf(input)));
    expect(out).toContain('"reasoning_content":"thinking..."');
    expect(out).toContain('"content":"answer"');
    expect(out).toContain("data: [DONE]");
  });

  it("reassembles a data line split across chunks", async () => {
    const full =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"split-across-chunks"}]}}]}\n\n';
    const mid = Math.floor(full.length / 2);
    const out = await drain(transformSSEStream(streamOf(full.slice(0, mid), full.slice(mid))));
    expect(out).toContain('"reasoning_content":"split-across-chunks"');
  });

  it("forwards downstream cancellation to the upstream reader", async () => {
    let upstreamCancelled: any = undefined;
    const upstream = new ReadableStream<Uint8Array>({
      pull() {
        // never resolves; only unblocks on cancel
      },
      cancel(reason) {
        upstreamCancelled = reason;
      },
    });
    const wrapped = transformSSEStream(upstream);
    await wrapped.cancel("abort-requested");
    expect(upstreamCancelled).toBe("abort-requested");
  });

  it("flushes a trailing partial line without newline at EOF", async () => {
    // No terminal newline — transform should still apply
    const input =
      'data: {"choices":[{"delta":{"reasoning_details":[{"type":"reasoning.text","text":"tail"}]}}]}';
    const out = await drain(transformSSEStream(streamOf(input)));
    expect(out).toContain('"reasoning_content":"tail"');
  });
});

describe("transformSSEResponse", () => {
  it("preserves status, statusText, and headers", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.close();
      },
    });
    const original = new Response(body, {
      status: 200,
      statusText: "OK",
      headers: { "content-type": "text/event-stream", "x-foo": "bar" },
    });
    const wrapped = transformSSEResponse(original);
    expect(wrapped.status).toBe(200);
    expect(wrapped.statusText).toBe("OK");
    expect(wrapped.headers.get("content-type")).toBe("text/event-stream");
    expect(wrapped.headers.get("x-foo")).toBe("bar");
  });
});
