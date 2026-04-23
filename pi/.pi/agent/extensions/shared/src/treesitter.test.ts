import { describe, it, expect } from "bun:test";
import { extractSymbols, getParser, initTreeSitter } from "./treesitter";

describe("treesitter", () => {
  it("initializes without error", async () => {
    await expect(initTreeSitter()).resolves.toBeUndefined();
  });

  it("supports .ts extension", async () => {
    const parser = await getParser(".ts");
    expect(parser).not.toBeNull();
  });

  it("returns null for unknown extensions", async () => {
    const parser = await getParser(".madeup");
    expect(parser).toBeNull();
  });

  it("extracts functions and classes from TypeScript", async () => {
    const source = `
export function add(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  multiply(x: number, y: number): number {
    return x * y;
  }
}

export interface MathOp {
  (a: number, b: number): number;
}

export type Point = { x: number; y: number };
`;
    const outline = await extractSymbols("calc.ts", source);
    expect(outline).not.toBeNull();
    const symbols = outline!.symbols;

    const func = symbols.find((s) => s.kind === "function" && s.name === "add");
    expect(func).toBeDefined();
    expect(func!.line).toBe(2);

    const cls = symbols.find((s) => s.kind === "class" && s.name === "Calculator");
    expect(cls).toBeDefined();
    expect(cls!.line).toBe(6);

    const iface = symbols.find((s) => s.kind === "interface" && s.name === "MathOp");
    expect(iface).toBeDefined();

    const alias = symbols.find((s) => s.kind === "type_alias" && s.name === "Point");
    expect(alias).toBeDefined();
  });

  it("extracts exports correctly", async () => {
    const source = `export const PI = 3.14;`;
    const outline = await extractSymbols("const.ts", source);
    expect(outline).not.toBeNull();
    const exports = outline!.symbols.filter((s) => s.kind === "export");
    expect(exports.length).toBeGreaterThanOrEqual(1);
  });

  it("extracts JavaScript functions", async () => {
    const source = "function greet(name) { return 'Hello, ' + name; }";
    const outline = await extractSymbols("greet.js", source);
    expect(outline).not.toBeNull();
    const func = outline!.symbols.find((s) => s.kind === "function");
    expect(func?.name).toBe("greet");
  });

  it("extracts Python functions", async () => {
    const source = `
def add(a, b):
    return a + b

class Calculator:
    def multiply(self, x, y):
        return x * y
`;
    const outline = await extractSymbols("calc.py", source);
    expect(outline).not.toBeNull();
    const func = outline!.symbols.find((s) => s.kind === "function" && s.name === "add");
    expect(func).toBeDefined();
    const cls = outline!.symbols.find((s) => s.kind === "class" && s.name === "Calculator");
    expect(cls).toBeDefined();
  });

  it("returns null for unsupported language", async () => {
    const source = `Some plain text content here`;
    const outline = await extractSymbols("notes.txt", source);
    expect(outline).toBeNull();
  });

  it("extracts Svelte script block symbols", async () => {
    const source = `<script>
  export let count = 0;
  function increment() {
    count++;
  }
</script>

<button on:click={increment}>
  Clicks: {count}
</button>
`;
    const outline = await extractSymbols("Counter.svelte", source);
    expect(outline).not.toBeNull();
    expect(outline!.language).toBe(".svelte");

    const func = outline!.symbols.find((s) => s.kind === "function" && s.name === "increment");
    expect(func).toBeDefined();

    const variable = outline!.symbols.find((s) => s.kind === "variable");
    expect(variable).toBeDefined();
  });

  it("extracts Vue script block symbols as TypeScript when lang=ts", async () => {
    const source = `<script setup lang="ts">
  import { ref } from "vue";
  const count = ref(0);
  function increment(): void {
    count.value++;
  }
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
`;
    const outline = await extractSymbols("Counter.vue", source);
    expect(outline).not.toBeNull();
    expect(outline!.language).toBe(".vue");

    const func = outline!.symbols.find((s) => s.kind === "function" && s.name === "increment");
    expect(func).toBeDefined();
    expect(func?.type).toContain("()");

    const variable = outline!.symbols.find((s) => s.kind === "variable");
    expect(variable).toBeDefined();
  });

  it("extracts Vue script block symbols as JavaScript by default", async () => {
    const source = `<script>
  export default {
    data() {
      return { count: 0 };
    },
    methods: {
      increment() {
        this.count++;
      }
    }
  };
</script>
`;
    const outline = await extractSymbols("Legacy.vue", source);
    expect(outline).not.toBeNull();
    const func = outline!.symbols.find((s) => s.kind === "function" || s.kind === "method");
    expect(func).toBeDefined();
  });

  it("returns null for Svelte files without script blocks", async () => {
    const source = `<div>No script here</div>
`;
    const outline = await extractSymbols("Empty.svelte", source);
    expect(outline).toBeNull();
  });
});
