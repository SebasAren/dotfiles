import { describe, it, expect } from "bun:test";

import { editSchema, readSchema, prepareArguments } from "./schema";

describe("readSchema", () => {
  it("has type 'object'", () => {
    expect(readSchema.type).toBe("object");
  });
});

describe("editSchema", () => {
  it("has type 'object'", () => {
    expect(editSchema.type).toBe("object");
  });
});

describe("prepareArguments", () => {
  it("passes through standard hashline format", () => {
    const input = {
      path: "test.ts",
      edits: [{ pos: "11#KT", lines: ["  return 43;"] }],
    };
    const result = prepareArguments(input);
    expect(result.path).toBe("test.ts");
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].pos).toBe("11#KT");
  });

  it("parses JSON-stringified edits", () => {
    const result = prepareArguments({
      path: "test.ts",
      edits: JSON.stringify([{ pos: "11#KT", lines: ["new"] }]),
    });
    expect(result.path).toBe("test.ts");
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].pos).toBe("11#KT");
  });

  it("wraps single edit at root level", () => {
    const result = prepareArguments({
      path: "test.ts",
      pos: "11#KT",
      lines: ["new"],
    });
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].pos).toBe("11#KT");
  });

  it("strips display prefix from pos", () => {
    const result = prepareArguments({
      path: "test.ts",
      edits: [{ pos: "11#KT:   return 42;", lines: ["  return 43;"] }],
    });
    expect(result.edits[0].pos).toBe("11#KT");
  });

  it("strips display prefix from end", () => {
    const result = prepareArguments({
      path: "test.ts",
      edits: [{ pos: "10#VR", end: "15#MB:   old code", lines: ["new"] }],
    });
    expect(result.edits[0].end).toBe("15#MB");
  });

  it("wraps single-object edits in array", () => {
    const result = prepareArguments({
      path: "test.ts",
      edits: { pos: "5#ZP", lines: ["hello"] } as any,
    });
    expect(result.edits).toHaveLength(1);
    expect(result.edits[0].pos).toBe("5#ZP");
  });

  it("passes through null/undefined as-is", () => {
    expect(prepareArguments(null)).toBe(null);
    expect(prepareArguments(undefined)).toBe(undefined);
  });

  it("handles multiple edits", () => {
    const result = prepareArguments({
      path: "app.ts",
      edits: [
        { pos: "1#AB", lines: ["import x;"] },
        { pos: "20#CD", lines: ["export y;"] },
      ],
    });
    expect(result.edits).toHaveLength(2);
  });
});
