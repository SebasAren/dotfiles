import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js/lib/core";

// Register common languages for syntax highlighting
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import rust from "highlight.js/lib/languages/rust";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import cpp from "highlight.js/lib/languages/cpp";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("rust", rust);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);

// Create a marked instance with highlight.js support
const marked = new Marked(
  markedHighlight({
    emptyLangClass: "hljs",
    langPrefix: "hljs language-",
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      // No language hint — return raw code wrapped in <code> to avoid hljs errors
      return code;
    },
  }),
);

// Escape raw HTML blocks to prevent XSS from assistant output
marked.use({
  renderer: {
    html(token: unknown): string {
      const raw = typeof token === "string" ? token : ((token as { raw?: string })?.raw ?? "");
      return raw
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
  },
});

/**
 * Convert markdown to a fully styled HTML document with terminal aesthetic.
 *
 * Uses marked for markdown parsing and highlight.js for code block syntax
 * highlighting. The output is a complete HTML document suitable for rendering
 * in a headless browser (Playwright) for screenshot capture.
 */
export function markdownToHtml(markdown: string): string {
  const bodyHtml = marked.parse(markdown) as string;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #1e1e2e;
    color: #cdd6f4;
    font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 13px;
    line-height: 1.6;
    padding: 24px;
    min-width: 800px;
  }
  h1, h2, h3, h4, h5, h6 {
    color: #cba6f7;
    margin: 16px 0 8px 0;
    font-weight: 700;
  }
  h1 { font-size: 20px; border-bottom: 1px solid #45475a; padding-bottom: 8px; }
  h2 { font-size: 17px; }
  h3 { font-size: 15px; }
  p { margin: 8px 0; }
  strong { color: #f9e2af; }
  em { color: #a6e3a1; }
  code {
    background: #313244;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 12px;
  }
  pre {
    background: #181825;
    border: 1px solid #45475a;
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    overflow-x: auto;
  }
  pre code {
    background: none;
    padding: 0;
    font-size: 12px;
  }
  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }
  li { margin: 4px 0; }
  a { color: #89b4fa; text-decoration: none; }
  a:hover { text-decoration: underline; }
  blockquote {
    border-left: 3px solid #585b70;
    padding-left: 12px;
    color: #a6adc8;
    margin: 8px 0;
  }
  table {
    border-collapse: collapse;
    margin: 12px 0;
    width: 100%;
  }
  th, td {
    border: 1px solid #45475a;
    padding: 8px 12px;
    text-align: left;
  }
  th { background: #313244; color: #cba6f7; }
  hr {
    border: none;
    border-top: 1px solid #45475a;
    margin: 16px 0;
  }

  /* highlight.js theme (Catppuccin Mocha inspired) */
  .hljs-keyword { color: #cba6f7; }
  .hljs-string { color: #a6e3a1; }
  .hljs-number { color: #fab387; }
  .hljs-comment { color: #6c7086; font-style: italic; }
  .hljs-function { color: #89b4fa; }
  .hljs-class { color: #f9e2af; }
  .hljs-title { color: #89b4fa; }
  .hljs-params { color: #cdd6f4; }
  .hljs-built_in { color: #f38ba8; }
  .hljs-type { color: #f9e2af; }
  .hljs-meta { color: #6c7086; }
  .hljs-operator { color: #89dceb; }
  .hljs-punctuation { color: #a6adc8; }

  /* Watermark */
  .watermark {
    position: fixed;
    bottom: 12px;
    right: 16px;
    font-size: 11px;
    color: #585b70;
    opacity: 0.6;
    font-style: italic;
    pointer-events: none;
  }
</style>
</head>
<body>
${bodyHtml}
<div class="watermark">SebbaFlow™</div>
</body>
</html>`;
}
