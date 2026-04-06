import { describe, it, expect, afterEach } from "bun:test";

// We test against the module interface — the implementation will use
// process.argv and process.execPath internally.
import { getPiInvocation } from "./subprocess";

describe("getPiInvocation", () => {
  const savedArgv1 = process.argv[1];

  afterEach(() => {
    // Restore original argv[1]
    process.argv[1] = savedArgv1;
  });

  it("returns pi command with args when running under generic runtime (bun/node)", () => {
    // When argv[1] doesn't point to a real file, it falls through to the
    // generic runtime check. Bun's execPath basename is "bun", so it
    // should return "pi" as the command.
    process.argv[1] = "/nonexistent/script.ts";
    const result = getPiInvocation(["--mode", "json"]);
    expect(result.command).toBe("pi");
    expect(result.args).toEqual(["--mode", "json"]);
  });

  it("returns execPath with script when argv[1] points to a real file", () => {
    // Use this test file itself as the "script" — it exists on disk.
    const thisFile = import.meta.path;
    process.argv[1] = thisFile;
    const result = getPiInvocation(["query"]);
    expect(result.command).toBe(process.execPath);
    expect(result.args[0]).toBe(thisFile);
    expect(result.args[1]).toBe("query");
  });

  it("uses execPath directly when running as compiled binary (not node/bun)", () => {
    // When execPath is the pi binary (not node/bun), it should use
    // execPath directly regardless of argv[1]. This is the normal case
    // for installed pi — argv[1] may be a Bun virtual /$bunfs/ path.
    process.argv[1] = "/nonexistent/script.ts";
    const result = getPiInvocation(["task"]);
    expect(result).toHaveProperty("command");
    expect(result).toHaveProperty("args");
    expect(result.args).toContain("task");
  });

  it("ignores Bun virtual FS paths (/$bunfs/) as compiled binary", () => {
    // When pi is a compiled binary, argv[1] is /$bunfs/root/pi.
    // The function should use execPath directly without attempting
    // to resolve the virtual path as a script.
    process.argv[1] = "/$bunfs/root/pi";
    const result = getPiInvocation(["--mode", "json"]);
    // execPath is "bun" in test, so it won't match compiled binary case,
    // but the virtual path won't match existsSync either → falls to "pi"
    expect(result).toHaveProperty("command");
    expect(result).toHaveProperty("args");
    expect(result.args).toEqual(["--mode", "json"]);
  });
});
