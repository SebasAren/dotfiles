import { describe, it, expect } from "bun:test";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";

describe("marked API contract", () => {
  it("accepts markedHighlight plugin in constructor", () => {
    const marked = new Marked(
      markedHighlight({
        emptyLangClass: "hljs",
        langPrefix: "hljs language-",
        highlight: (code: string, _lang: string) => code,
      }),
    );
    expect(marked).toBeDefined();
    expect(typeof marked.parse).toBe("function");
  });

  it("accepts custom renderer via marked.use()", () => {
    const marked = new Marked();
    marked.use({
      renderer: {
        html: () => "",
      },
    });
    const html = marked.parse("# Hello");
    expect(typeof html).toBe("string");
  });

  it("parses markdown to expected HTML", () => {
    const marked = new Marked();
    const html = marked.parse("# Title\n\n**bold**\n\n- item") as string;
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>item</li>");
  });
});
