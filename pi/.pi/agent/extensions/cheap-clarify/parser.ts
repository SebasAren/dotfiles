/**
 * Question extraction logic for the cheap-clarify extension.
 *
 * Parses assistant messages, builds extraction prompts, and turns raw
 * model output into structured {@link Question} objects.
 */

import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

// ── Types ──────────────────────────────────────────────────────────────────

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  prompt: string;
  options: QuestionOption[];
  allowOther: boolean;
}

export interface Answer {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  index?: number;
}

export interface QuestionnaireResult {
  questions: Question[];
  answers: Answer[];
  cancelled: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function getLastAssistantText(ctx: ExtensionCommandContext): string | undefined {
  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "message" || entry.message?.role !== "assistant") continue;

    const content = entry.message.content;
    if (typeof content === "string") return content;
    if (!Array.isArray(content)) continue;

    const parts = content
      .filter(
        (c): c is { type: "text"; text: string } =>
          c?.type === "text" && typeof c.text === "string",
      )
      .map((c) => c.text);
    const text = parts.join("\n").trim();
    if (text) return text;
  }
  return undefined;
}

export function parseCheapModel(): { provider: string; modelId: string } | undefined {
  const raw = process.env.CHEAP_MODEL;
  if (!raw) return undefined;
  const parts = raw.split("/");
  if (parts.length !== 2) return undefined;
  return { provider: parts[0].trim(), modelId: parts[1].trim() };
}

export function hasQuestionMarks(text: string): boolean {
  return /\?/.test(text);
}

export function buildExtractPrompt(assistantText: string): string {
  return [
    "Extract the questions from this assistant message. For each question, output a block",
    "using the exact format below. Output nothing else.",
    "",
    "Format per question:",
    "  Q: <the question prompt>",
    "  A: <option 1>",
    "  A: <option 2>",
    "  A: <option 3>",
    "  ALLOW_OTHER: <true|false>",
    "  ---",
    "",
    "Rules:",
    "- Only extract genuine questions asking the user for a decision or input.",
    "- Do NOT extract rhetorical questions (e.g. 'Ready?', 'Sounds good?', 'Make sense?').",
    "- Provide 2–5 sensible options per question.",
    "- Always include ALLOW_OTHER: true so the user can type a custom answer.",
    "- If no real questions exist, output: NO_QUESTIONS",
    "",
    "Assistant message:",
    "---",
    assistantText,
    "---",
  ].join("\n");
}

export function parseQuestions(raw: string): Question[] | undefined {
  const trimmed = raw.trim();
  if (!trimmed || /^NO_QUESTIONS/i.test(trimmed)) return undefined;

  const blocks = trimmed.split(/^\s*---\s*$/m).filter((b) => b.trim());
  const questions: Question[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const questionLine = lines.find((l) => /^Q:\s/.test(l.trim()));
    if (!questionLine) continue;

    const prompt = questionLine.trim().replace(/^Q:\s*/, "");
    if (!prompt) continue;

    const options: QuestionOption[] = [];
    let allowOther = true;

    for (const line of lines) {
      const t = line.trim();
      if (/^A:\s/.test(t)) {
        const value = t.replace(/^A:\s*/, "");
        if (value) {
          const _idx = options.length + 1;
          options.push({ value: value.toLowerCase().replace(/\s+/g, "-"), label: value });
        }
      } else if (/^ALLOW_OTHER:\s*false/i.test(t)) {
        allowOther = false;
      }
    }

    // A question with zero options is noise (e.g. a stray 'Q:' line)
    if (options.length === 0) continue;

    const qi = questions.length + 1;
    questions.push({
      id: `q${qi}`,
      label: `Q${qi}`,
      prompt,
      options,
      allowOther,
    });
  }

  return questions.length > 0 ? questions : undefined;
}
