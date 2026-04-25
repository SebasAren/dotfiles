import { describe, it, expect, mock, beforeEach } from "bun:test";

// Track mock spawnSync calls and results across tests
const mockSpawnSync = mock(() => ({ status: 0, error: undefined }));

// mock.module is hoisted by Bun — must be at top level
mock.module("child_process", () => ({
  spawnSync: mockSpawnSync,
}));

// Import after mock is registered
import { copyToClipboard } from "./copyToClipboard";

describe("copyToClipboard", () => {
  beforeEach(() => {
    mockSpawnSync.mockClear();
  });
  it("tries wl-copy with image/png type first", () => {
    mockSpawnSync.mockImplementation(() => ({ status: 0, error: undefined }));

    const png = Buffer.from("fake-png-data");
    copyToClipboard(png);

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "wl-copy",
      ["--type", "image/png"],
      {
        input: png,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  });

  it("falls back to xclip when wl-copy is not found", () => {
    mockSpawnSync.mockImplementation((cmd: string) => {
      if (cmd === "wl-copy") return { status: null, error: new Error("ENOENT") };
      return { status: 0, error: undefined };
    });

    const png = Buffer.from("fake-png-data");
    copyToClipboard(png);

    expect(mockSpawnSync).toHaveBeenCalledWith(
      "xclip",
      ["-selection", "clipboard", "-t", "image/png"],
      { input: png, stdio: ["pipe", "pipe", "pipe"] },
    );
  });

  it("falls back to pbcopy when wl-copy and xclip are not found", () => {
    mockSpawnSync.mockImplementation((cmd: string) => {
      if (cmd === "wl-copy" || cmd === "xclip") {
        return { status: null, error: new Error("ENOENT") };
      }
      return { status: 0, error: undefined };
    });

    const png = Buffer.from("fake-png-data");
    copyToClipboard(png);

    expect(mockSpawnSync).toHaveBeenCalledWith("pbcopy", [], {
      input: png,
      stdio: ["pipe", "pipe", "pipe"],
    });
  });

  it("returns immediately when a utility succeeds", () => {
    mockSpawnSync.mockImplementation(() => ({ status: 0, error: undefined }));

    const png = Buffer.from("fake-png-data");
    expect(() => copyToClipboard(png)).not.toThrow();
    expect(mockSpawnSync).toHaveBeenCalledTimes(1);
  });

  it("throws when a utility is killed by a signal", () => {
    mockSpawnSync.mockImplementation(() => ({
      status: null,
      error: undefined,
      signal: "SIGKILL",
      stderr: Buffer.from(""),
    }));

    const png = Buffer.from("fake-png-data");
    expect(() => copyToClipboard(png)).toThrow("wl-copy was killed by signal SIGKILL");
  });

  it("throws when a utility exits with non-zero status", () => {
    mockSpawnSync.mockImplementation(() => ({
      status: 1,
      error: undefined,
      stderr: Buffer.from("clipboard locked"),
    }));

    const png = Buffer.from("fake-png-data");
    expect(() => copyToClipboard(png)).toThrow("wl-copy failed (exit 1): clipboard locked");
  });

  it("throws a final error when no clipboard utility is available", () => {
    mockSpawnSync.mockImplementation(() => ({
      status: null,
      error: new Error("ENOENT"),
    }));

    const png = Buffer.from("fake-png-data");
    expect(() => copyToClipboard(png)).toThrow(
      "No clipboard utility found. Install one of: wl-copy (wl-clipboard), xclip, or pbcopy.",
    );
  });
});
