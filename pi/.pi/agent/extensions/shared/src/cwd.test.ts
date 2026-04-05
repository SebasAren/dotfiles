import { describe, it, expect, beforeEach, afterEach, afterAll } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveRealCwd } from "./cwd";

describe("resolveRealCwd", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cwd-test-"));
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv.PI_REAL_CWD = process.env.PI_REAL_CWD;
    savedEnv.PWD = process.env.PWD;
  });

  afterEach(() => {
    process.env.PI_REAL_CWD = savedEnv.PI_REAL_CWD;
    process.env.PWD = savedEnv.PWD;
  });

  // cleanup temp dir after all tests
  afterAll(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("returns realpath of cwd when it exists", () => {
    delete process.env.PI_REAL_CWD;
    delete process.env.PWD;
    const result = resolveRealCwd(tmpDir);
    expect(result).toBe(fs.realpathSync(tmpDir));
  });

  it("returns PI_REAL_CWD when set and path exists", () => {
    process.env.PI_REAL_CWD = tmpDir;
    delete process.env.PWD;
    const result = resolveRealCwd("/fake/bunfs/path");
    expect(result).toBe(tmpDir);
  });

  it("falls back to PWD when realpath fails", () => {
    delete process.env.PI_REAL_CWD;
    process.env.PWD = tmpDir;
    const result = resolveRealCwd("/nonexistent/virtual/path");
    expect(result).toBe(tmpDir);
  });

  it("falls back to process.cwd() when all else fails", () => {
    delete process.env.PI_REAL_CWD;
    delete process.env.PWD;
    const result = resolveRealCwd("/nonexistent/virtual/path");
    expect(result).toBe(process.cwd());
  });
});
