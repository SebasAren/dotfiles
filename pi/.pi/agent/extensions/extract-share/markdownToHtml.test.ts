import { describe, it, expect } from "bun:test";
import { markdownToHtml } from "./markdownToHtml";

describe("markdownToHtml", () => {
  describe("markdown conversion", () => {
    it("converts h1 headers to HTML", () => {
      const md = "# Hello";
      const html = markdownToHtml(md);
      expect(html).toContain("<h1>");
      expect(html).toContain("Hello");
    });

    it("converts h2 headers to HTML", () => {
      const md = "## World";
      const html = markdownToHtml(md);
      expect(html).toContain("<h2>");
      expect(html).toContain("World");
    });

    it("converts bold text", () => {
      const md = "**bold text**";
      const html = markdownToHtml(md);
      expect(html).toContain("<strong>");
      expect(html).toContain("bold text");
    });

    it("converts unordered lists", () => {
      const md = "- item 1\n- item 2";
      const html = markdownToHtml(md);
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>");
      expect(html).toContain("item 1");
    });

    it("converts ordered lists", () => {
      const md = "1. first\n2. second";
      const html = markdownToHtml(md);
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>");
      expect(html).toContain("first");
    });

    it("converts inline code", () => {
      const md = "Use `console.log()`";
      const html = markdownToHtml(md);
      expect(html).toContain("<code>");
      expect(html).toContain("console.log()");
    });

    it("handles mixed content", () => {
      const md = "# Title\n\nSome **bold** text\n\n- item\n\n```js\ncode\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("<h1>");
      expect(html).toContain("<strong>");
      expect(html).toContain("<ul>");
    });
  });

  describe("code block syntax highlighting", () => {
    it("adds highlight.js language class to fenced code blocks", () => {
      const md = "```typescript\nconst x = 1;\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("language-typescript");
    });

    it("adds highlight.js hljs class to code blocks", () => {
      const md = "```python\nprint('hi')\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("hljs");
    });

    it("handles code blocks without language hint", () => {
      const md = "```\nplain code\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("<pre>");
      expect(html).toContain("</code>");
    });
  });

  describe("terminal theme", () => {
    it("includes CSS with dark background color", () => {
      const html = markdownToHtml("# Hello");
      expect(html).toMatch(/background\s*:/);
    });

    it("includes monospace font-family", () => {
      const html = markdownToHtml("# Hello");
      expect(html).toMatch(/font-family.*monospace/);
    });

    it("includes light text color for dark background", () => {
      const html = markdownToHtml("# Hello");
      expect(html).toMatch(/color\s*:/);
    });

    it("wraps content in a full HTML document", () => {
      const html = markdownToHtml("# Hello");
      expect(html.toLowerCase()).toContain("<html");
      expect(html.toLowerCase()).toContain("</html>");
    });
  });

  describe("raw html escaping", () => {
    it("escapes raw HTML tags to prevent XSS", () => {
      const md = "<script>alert(1)</script>";
      const html = markdownToHtml(md);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes inline HTML containing event handlers", () => {
      const md = '<img src=x onerror="alert(1)">';
      const html = markdownToHtml(md);
      expect(html).toContain("&lt;img");
      expect(html).toContain("&quot;alert(1)&quot;");
      expect(html).toContain("&gt;");
    });
  });

  describe("watermark", () => {
    it("includes SebbaFlow trademark watermark", () => {
      const html = markdownToHtml("# Hello");
      expect(html).toContain("SebbaFlow");
    });
  });
});
