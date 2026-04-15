import { describe, it, expect } from "bun:test";

describe("tdd-tree extension", () => {
  it("exports a default function", async () => {
    const mod = await import("./index");
    expect(typeof mod.default).toBe("function");
  });
});
