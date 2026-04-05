/**
 * Shared rendering utilities for subagent-based extensions.
 *
 * Provides the section-based expanded/collapsed result renderer used by
 * explore, librarian, and similar subagent tools, plus a reusable tool
 * call renderer and the context.lastComponent reuse pattern.
 */

import { type Component, Container, Markdown, Spacer, Text } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { getMarkdownTheme } from "@mariozechner/pi-coding-agent";

import { formatUsageLine } from "./format";
import { getSectionSummary, parseSections } from "./markdown";
import { splitIntoSentences } from "./sentences";

// ── Types ──────────────────────────────────────────────────────────────────

/** Common usage stats shape shared by subagent tools. */
export interface UsageInfo {
  input: number;
  output: number;
  turns: number;
  cost: number;
  contextTokens?: number;
}

/** Common details shape for subagent tool results. */
export interface SubagentResultDetails {
  model?: string;
  usedModel?: string;
  query?: string;
  success?: boolean;
  usage?: UsageInfo;
  [key: string]: unknown;
}

/** A tool result object as passed to renderResult. */
export interface ToolResultLike {
  content: Array<{ type: string; text?: string }>;
  details?: SubagentResultDetails;
}

/** Options for {@link renderSubagentResult}. */
export interface RenderSubagentResultOptions {
  /** The tool result to render. */
  result: ToolResultLike;
  /** Render state: expanded/collapsed and partial/streaming. */
  state: { expanded: boolean; isPartial: boolean };
  /** The current theme. */
  theme: Theme;
  /** Tool display name (e.g. "explore", "librarian"). */
  toolName: string;
  /** Label shown during streaming (e.g. "exploring", "researching"). */
  partialLabel: string;
  /**
   * Build the expanded-view header text below the title.
   * Receives details and theme; return a themed string or "" to skip.
   * Default: shows "Query: <query>" if details.query is set.
   */
  buildExpandedHeader?: (details: SubagentResultDetails, theme: Theme) => string;
}

/** Options for {@link renderSubagentCall}. */
export interface RenderSubagentCallOptions {
  /** Short preview text (already truncated). */
  preview: string;
  /** The current theme. */
  theme: Theme;
  /** Render context (for lastComponent reuse). */
  context: { lastComponent?: Component };
  /** Tool display name (e.g. "explore", "librarian"). */
  toolName: string;
  /** Optional model tag. */
  model?: string;
  /** Optional extra themed lines to append (one per entry). */
  extras?: string[];
}

// ── Default header builder ─────────────────────────────────────────────────

const defaultHeader = (details: SubagentResultDetails, theme: Theme): string => {
  if (!details.query) return "";
  return theme.fg("muted", "Query: ") + theme.fg("dim", details.query);
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Reuse the last rendered component (if it's a Text) or create a new one.
 *
 * This is the `context.lastComponent` reuse pattern used in almost every
 * renderCall implementation.
 */
export function reuseOrCreateText(context: { lastComponent?: Component }): Text {
  return (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
}

/**
 * Render a subagent tool call with model tag and query preview.
 *
 * Produces a themed Text component:
 * ```
 * <toolName> [model] <preview>
 *   <extra line 1>
 *   <extra line 2>
 * ```
 */
export function renderSubagentCall(options: RenderSubagentCallOptions): Text {
  const { preview, theme, context, toolName, model, extras } = options;

  let content = theme.fg("toolTitle", theme.bold(`${toolName} `));
  if (model) content += theme.fg("muted", `[${model}] `);
  content += theme.fg("dim", preview);

  if (extras?.length) {
    for (const extra of extras) {
      content += `\n  ${extra}`;
    }
  }

  const text = reuseOrCreateText(context);
  text.setText(content);
  return text;
}

/**
 * Renders a subagent tool result with section-based expanded/collapsed views.
 *
 * Shared by explore, librarian, and any future subagent tools that produce
 * `## Section`-based markdown output.
 *
 * **Streaming/partial:** Shows `⏳ <partialLabel>...` with parsed sections.
 * **Expanded:** Icon + header + section dividers + markdown + usage line.
 * **Collapsed:** Icon + section summaries (or sentence bullets as fallback) + usage + expand hint.
 */
export function renderSubagentResult(options: RenderSubagentResultOptions): Component {
  const {
    result,
    state: { expanded, isPartial },
    theme,
    toolName,
    partialLabel,
  } = options;

  const details = result.details;
  const textContent = result.content[0];
  const output = textContent?.type === "text" ? (textContent.text ?? "(no output)") : "(no output)";
  const isError = details?.success === false;
  const icon = isError ? theme.fg("error", "✗") : theme.fg("success", "✓");
  const sections = parseSections(output);

  // ── Streaming/partial ───────────────────────────────────────────────
  if (isPartial) {
    if (sections.length === 0) {
      return new Text(theme.fg("warning", `⏳ ${partialLabel}...`), 0, 0);
    }
    let content = theme.fg("warning", "⏳ ") + theme.fg("toolTitle", theme.bold(toolName));
    for (const section of sections) {
      const summary = getSectionSummary(section.content);
      content += `\n  ${theme.fg("muted", `${section.title}:`)} ${theme.fg("dim", summary)}`;
    }
    return new Text(content, 0, 0);
  }

  // ── Expanded ────────────────────────────────────────────────────────
  const mdTheme = getMarkdownTheme();

  if (expanded) {
    const container = new Container();
    container.addChild(new Text(`${icon} ${theme.fg("toolTitle", theme.bold(toolName))}`, 0, 0));

    const buildHeader = options.buildExpandedHeader ?? defaultHeader;
    const header = buildHeader(details ?? {}, theme);
    if (header) {
      container.addChild(new Text(header, 0, 0));
    }

    if (isError) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("error", output), 0, 0));
    } else if (sections.length > 0) {
      for (const section of sections) {
        container.addChild(new Spacer(1));
        container.addChild(new Text(theme.fg("muted", `─── ${section.title} ───`), 0, 0));
        if (section.content) {
          container.addChild(new Markdown(section.content, 0, 0, mdTheme));
        }
      }
    } else {
      container.addChild(new Spacer(1));
      container.addChild(new Markdown(output.trim(), 0, 0, mdTheme));
    }

    if (details?.usage) {
      const usageLine = formatUsageLine(details.usage, details.usedModel);
      if (usageLine) {
        container.addChild(new Spacer(1));
        container.addChild(new Text(theme.fg("dim", usageLine), 0, 0));
      }
    }
    return container;
  }

  // ── Collapsed ───────────────────────────────────────────────────────
  let rendered = `${icon} ${theme.fg("toolTitle", theme.bold(toolName))}`;

  if (isError) {
    const errorPreview = output.length > 120 ? `${output.slice(0, 120)}...` : output;
    rendered += `\n  ${theme.fg("error", errorPreview)}`;
  } else if (sections.length > 0) {
    for (const section of sections) {
      const summary = getSectionSummary(section.content);
      rendered += `\n  ${theme.fg("muted", `${section.title}:`)} ${theme.fg("dim", summary)}`;
    }
  } else {
    // Fallback for unstructured output — use shared sentence parser
    const sentences = splitIntoSentences(output);

    if (sentences.length === 0) {
      const preview = output.length > 150 ? `${output.slice(0, 150)}...` : output;
      rendered += `\n  ${theme.fg("dim", preview)}`;
    } else {
      const maxItems = Math.min(sentences.length, 4);
      for (let i = 0; i < maxItems; i++) {
        rendered += `\n  ${theme.fg("muted", "•")} ${theme.fg("dim", sentences[i].text)}`;
      }
      if (sentences.length > 4) {
        rendered += `\n  ${theme.fg("muted", `... +${sentences.length - 4} more`)}`;
      }
    }
  }

  if (details?.usage) {
    const usageLine = formatUsageLine(details.usage, details.usedModel);
    if (usageLine) rendered += `\n  ${theme.fg("dim", usageLine)}`;
  }
  rendered += `\n  ${theme.fg("muted", "(Ctrl+O to expand)")}`;
  return new Text(rendered, 0, 0);
}
