import { describe, it, expect } from "bun:test";
import { argsSignature, detectLoop } from "./loop-detection";
import type { LoopResult } from "./loop-detection";

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

  it("does NOT flag 3-tool loops (requires 4+ distinct tools)", () => {
    // 3-tool loops are too common during normal exploration
    const history = [
      call("grep", "a"),
      call("read", "b"),
      call("find", "c"),
      // repeated:
      call("grep", "a"),
      call("read", "b"),
      call("find", "c"),
    ];
    expect(detectLoop(history)).toBeNull();
  });

  it("flags a genuine 4-tool loop with 4+ distinct tools", () => {
    const history = [
      call("grep", "a"),
      call("read", "b"),
      call("find", "c"),
      call("bash", "d"),
      // repeated:
      call("grep", "a"),
      call("read", "b"),
      call("find", "c"),
      call("bash", "d"),
    ];
    const result = detectLoop(history);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("kill");
    expect(result!.message).toContain("4-tool sequence repeated");
    expect(result!.message).toContain("grep, read, find, bash");
  });

  it("kills at 3+ identical consecutive calls", () => {
    const history = [
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
      call("grep", "same-pattern"),
    ];
    const result = detectLoop(history);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("kill");
    expect(result!.message).toContain("called 3 times with same args");
  });

  it("warns at 2 identical consecutive calls", () => {
    const history = [
      call("read", "same-file"),
      call("read", "same-file"),
    ];
    const result = detectLoop(history);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("warn");
    expect(result!.message).toContain("called 2 times with same args");
  });

  it("does NOT flag a single call", () => {
    const history = [call("grep", "same-pattern")];
    expect(detectLoop(history)).toBeNull();
  });

  it("escalates from warn to kill as duplicates accumulate", () => {
    const callEntry = call("read", "file.ts");
    // 2 calls → warn
    expect(detectLoop([callEntry, callEntry])!.severity).toBe("warn");
    // 3 calls → kill
    expect(detectLoop([callEntry, callEntry, callEntry])!.severity).toBe("kill");
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
    // With window=8, a 4-tool loop with 4 distinct tools should be detected
    const history = [
      call("grep", "a"),
      call("read", "b"),
      call("bash", "c"),
      call("find", "d"),
      call("grep", "a"),
      call("read", "b"),
      call("bash", "c"),
      call("find", "d"),
    ];
    const result = detectLoop(history, 8);
    expect(result).not.toBeNull();
    expect(result!.severity).toBe("kill");
  });

  it("ignores calls outside window size", () => {
    // Old calls outside window should not affect detection
    const history = [
      call("grep", "old"),
      call("grep", "old"),
      call("grep", "old"),
      call("grep", "old"),
      call("grep", "old"),
      call("grep", "old"),
      // New pattern starts here
      call("grep", "new"),
      call("read", "x"),
      call("bash", "y"),
      call("find", "z"),
      call("grep", "new"),
      call("read", "x"),
      call("bash", "y"),
      call("find", "z"),
    ];
    // With window=8, only sees the last 8 calls (new pattern repeated)
    expect(detectLoop(history, 8)).not.toBeNull();
  });
});
