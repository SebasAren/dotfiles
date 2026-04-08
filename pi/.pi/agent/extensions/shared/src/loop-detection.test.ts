import { describe, it, expect } from "bun:test";
import { argsSignature, detectLoop } from "./loop-detection";

// ── argsSignature ──────────────────────────────────────────────────────────

describe("argsSignature", () => {
  it("produces different signatures for different args", () => {
    const a = argsSignature({ pattern: "foo", path: "src" });
    const b = argsSignature({ pattern: "bar", path: "src" });
    expect(a).not.toBe(b);
  });

  it("produces same signature for identical args", () => {
    const a = argsSignature({ pattern: "foo", path: "src" });
    const b = argsSignature({ pattern: "foo", path: "src" });
    expect(a).toBe(b);
  });

  it("normalizes trailing slashes", () => {
    const a = argsSignature({ path: "src/" });
    const b = argsSignature({ path: "src" });
    expect(a).toBe(b);
  });

  it("normalizes ./ prefix", () => {
    const a = argsSignature({ path: "./src" });
    const b = argsSignature({ path: "src" });
    expect(a).toBe(b);
  });

  it("truncates long values", () => {
    const longVal = "x".repeat(200);
    const sig = argsSignature({ pattern: longVal });
    expect(sig).toContain("...");
  });
});

// ── detectLoop ─────────────────────────────────────────────────────────────

describe("detectLoop", () => {
  // Helper to build tool history entries
  const call = (name: string, sig: string) => ({ name, argsSignature: sig });

  it("returns null for empty history", () => {
    expect(detectLoop([])).toBeNull();
  });

  it("returns null for fewer than 6 calls", () => {
    const history = [
      call("grep", "a"),
      call("grep", "b"),
      call("grep", "c"),
      call("find", "d"),
      call("read", "e"),
    ];
    expect(detectLoop(history)).toBeNull();
  });

  it("does NOT flag (grep, grep, grep, find) repeated — only 2 distinct tools", () => {
    // This is the false-positive case from the issue: natural search broadening
    const history = [
      call("grep", "pattern1"),
      call("grep", "pattern2"),
      call("grep", "pattern3"),
      call("find", "name1"),
      call("grep", "pattern1"),
      call("grep", "pattern2"),
      call("grep", "pattern3"),
      call("find", "name1"),
    ];
    expect(detectLoop(history)).toBeNull();
  });

  it("does NOT flag 2-tool repeated subsequences (grep, read, grep, read)", () => {
    const history = [
      call("grep", "a"),
      call("read", "b"),
      call("grep", "c"),
      call("read", "d"),
      call("grep", "a"),
      call("read", "b"),
    ];
    expect(detectLoop(history)).toBeNull();
  });

  it("flags a genuine 3-tool loop with 3+ distinct tools", () => {
    const history = [
      call("grep", "a"),
      call("read", "b"),
      call("find", "c"),
      // repeated:
      call("grep", "a"),
      call("read", "b"),
      call("find", "c"),
    ];
    const result = detectLoop(history);
    expect(result).not.toBeNull();
    expect(result).toContain("3-tool sequence repeated");
    expect(result).toContain("grep, read, find");
  });

  it("flags 4+ identical consecutive calls", () => {
    const history = [
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
    ];
    const result = detectLoop(history);
    expect(result).not.toBeNull();
    expect(result).toContain("called 4 times with same args");
  });

  it("does NOT flag 3 identical consecutive calls", () => {
    const history = [
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
    ];
    expect(detectLoop(history)).toBeNull();
  });

  it("does NOT flag natural exploration pattern with varied greps and reads", () => {
    // Simulates: search for multiple keywords, read matching files
    const history = [
      call("grep", "DeliveryDetailsTable"),
      call("grep", "AdminCurrentDeliveryRow"),
      call("grep", "ETA"),
      call("find", "delivery"),
      call("grep", "DeliveryDetailsTable-src"),
      call("grep", "AdminCurrentDeliveryRow-src"),
      call("read", "file1.tsx"),
      call("read", "file2.tsx"),
      call("grep", "time-estimation"),
      call("find", "components"),
      call("read", "file3.tsx"),
      call("grep", "delivery-row"),
    ];
    expect(detectLoop(history)).toBeNull();
  });

  it("uses configurable window size", () => {
    // With window=6, a 3-tool loop with 3 distinct tools should be detected
    const history = [
      call("grep", "a"),
      call("read", "b"),
      call("bash", "c"),
      call("grep", "a"),
      call("read", "b"),
      call("bash", "c"),
    ];
    expect(detectLoop(history, 6)).not.toBeNull();
  });
});
