export function extractText(content: string): string {
  // Strip YAML frontmatter
  let text = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, " ");
  // Strip wikilinks [[...]]
  text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, "$1");
  // Strip markdown links [text](url)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  // Strip images and bare URLs
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, " ");
  text = text.replace(/https?:\/\/\S+/g, " ");
  // Strip headings / bold / italic / code fences / inline code
  text = text.replace(/[#*`~\-_>]/g, " ");
  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}
