import { complete } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Editor, type EditorTheme, Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";

// ── Types ──────────────────────────────────────────────────────────────────

interface QuestionOption {
  value: string;
  label: string;
}

interface Question {
  id: string;
  label: string;
  prompt: string;
  options: QuestionOption[];
  allowOther: boolean;
}

interface Answer {
  id: string;
  value: string;
  label: string;
  wasCustom: boolean;
  index?: number;
}

interface QuestionnaireResult {
  questions: Question[];
  answers: Answer[];
  cancelled: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getLastAssistantText(ctx: ExtensionCommandContext): string | undefined {
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

function parseCheapModel(): { provider: string; modelId: string } | undefined {
  const raw = process.env.CHEAP_MODEL;
  if (!raw) return undefined;
  const parts = raw.split("/");
  if (parts.length !== 2) return undefined;
  return { provider: parts[0].trim(), modelId: parts[1].trim() };
}

function hasQuestionMarks(text: string): boolean {
  return /\?/.test(text);
}

function buildExtractPrompt(assistantText: string): string {
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

function parseQuestions(raw: string): Question[] | undefined {
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

// ── Questionnaire UI ───────────────────────────────────────────────────────

async function runQuestionnaire(
  questions: Question[],
  ctx: ExtensionCommandContext,
): Promise<QuestionnaireResult> {
  if (!ctx.hasUI) {
    return { questions, answers: [], cancelled: true };
  }

  const isMulti = questions.length > 1;
  const totalTabs = questions.length + 1; // questions + Submit

  return ctx.ui.custom<QuestionnaireResult>((tui, theme, _kb, done) => {
    let currentTab = 0;
    let optionIndex = 0;
    let inputMode = false;
    let inputQuestionId: string | null = null;
    let cachedLines: string[] | undefined;
    const answers = new Map<string, Answer>();

    const editorTheme: EditorTheme = {
      borderColor: (s) => theme.fg("accent", s),
      selectList: {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      },
    };
    const editor = new Editor(tui, editorTheme);

    function refresh() {
      cachedLines = undefined;
      tui.requestRender();
    }

    function submit(cancelled: boolean) {
      done({ questions, answers: Array.from(answers.values()), cancelled });
    }

    function currentQuestion(): Question | undefined {
      return questions[currentTab];
    }

    function currentOptions(): (QuestionOption & { isOther?: boolean })[] {
      const q = currentQuestion();
      if (!q) return [];
      const opts: (QuestionOption & { isOther?: boolean })[] = [...q.options];
      if (q.allowOther) {
        opts.push({ value: "__other__", label: "Type something.", isOther: true });
      }
      return opts;
    }

    function allAnswered(): boolean {
      return questions.every((q) => answers.has(q.id));
    }

    function advanceAfterAnswer() {
      if (!isMulti) {
        submit(false);
        return;
      }
      if (currentTab < questions.length - 1) {
        currentTab++;
      } else {
        currentTab = questions.length; // Submit tab
      }
      optionIndex = 0;
      refresh();
    }

    function saveAnswer(
      questionId: string,
      value: string,
      label: string,
      wasCustom: boolean,
      index?: number,
    ) {
      answers.set(questionId, { id: questionId, value, label, wasCustom, index });
    }

    editor.onSubmit = (value) => {
      if (!inputQuestionId) return;
      const trimmed = value.trim() || "(no response)";
      saveAnswer(inputQuestionId, trimmed, trimmed, true);
      inputMode = false;
      inputQuestionId = null;
      editor.setText("");
      advanceAfterAnswer();
    };

    function handleInput(data: string) {
      if (inputMode) {
        if (matchesKey(data, Key.escape)) {
          inputMode = false;
          inputQuestionId = null;
          editor.setText("");
          refresh();
          return;
        }
        editor.handleInput(data);
        refresh();
        return;
      }

      const q = currentQuestion();
      const opts = currentOptions();

      if (isMulti) {
        if (matchesKey(data, Key.tab) || matchesKey(data, Key.right)) {
          currentTab = (currentTab + 1) % totalTabs;
          optionIndex = 0;
          refresh();
          return;
        }
        if (matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) {
          currentTab = (currentTab - 1 + totalTabs) % totalTabs;
          optionIndex = 0;
          refresh();
          return;
        }
      }

      if (currentTab === questions.length) {
        if (matchesKey(data, Key.enter) && allAnswered()) {
          submit(false);
        } else if (matchesKey(data, Key.escape)) {
          submit(true);
        }
        return;
      }

      if (matchesKey(data, Key.up)) {
        optionIndex = Math.max(0, optionIndex - 1);
        refresh();
        return;
      }
      if (matchesKey(data, Key.down)) {
        optionIndex = Math.min(opts.length - 1, optionIndex + 1);
        refresh();
        return;
      }

      if (matchesKey(data, Key.enter) && q) {
        const opt = opts[optionIndex];
        if (opt?.isOther) {
          inputMode = true;
          inputQuestionId = q.id;
          editor.setText("");
          refresh();
          return;
        }
        saveAnswer(q.id, opt.value, opt.label, false, optionIndex + 1);
        advanceAfterAnswer();
        return;
      }

      if (matchesKey(data, Key.escape)) {
        submit(true);
      }
    }

    function render(width: number): string[] {
      if (cachedLines) return cachedLines;

      const lines: string[] = [];
      const add = (s: string) => lines.push(truncateToWidth(s, width));
      const q = currentQuestion();
      const opts = currentOptions();

      add(theme.fg("accent", "─".repeat(width)));
      add(theme.fg("accent", theme.bold(" 📝 Answer Questions ")));

      // Tab bar
      if (isMulti) {
        const tabs: string[] = ["← "];
        for (let i = 0; i < questions.length; i++) {
          const isActive = i === currentTab;
          const isAnswered = answers.has(questions[i].id);
          const box = isAnswered ? "■" : "□";
          const color = isAnswered ? "success" : "muted";
          const text = ` ${box} ${questions[i].label} `;
          const styled = isActive
            ? theme.bg("selectedBg", theme.fg("text", text))
            : theme.fg(color, text);
          tabs.push(`${styled} `);
        }
        const canSubmit = allAnswered();
        const isSubmitTab = currentTab === questions.length;
        const submitText = " ✓ Submit ";
        const submitStyled = isSubmitTab
          ? theme.bg("selectedBg", theme.fg("text", submitText))
          : theme.fg(canSubmit ? "success" : "dim", submitText);
        tabs.push(`${submitStyled} →`);
        add(` ${tabs.join("")}`);
        lines.push("");
      }

      function renderOptions() {
        for (let i = 0; i < opts.length; i++) {
          const opt = opts[i];
          const selected = i === optionIndex;
          const isOther = opt.isOther === true;
          const prefix = selected ? theme.fg("accent", "> ") : "  ";
          const color = selected ? "accent" : "text";
          if (isOther && inputMode) {
            add(prefix + theme.fg("accent", `${i + 1}. ${opt.label} ✎`));
          } else {
            add(prefix + theme.fg(color, `${i + 1}. ${opt.label}`));
          }
        }
      }

      if (inputMode && q) {
        add(theme.fg("text", ` ${q.prompt}`));
        lines.push("");
        renderOptions();
        lines.push("");
        add(theme.fg("muted", " Your answer:"));
        for (const line of editor.render(width - 2)) {
          add(` ${line}`);
        }
        lines.push("");
        add(theme.fg("dim", " Enter to submit • Esc to cancel"));
      } else if (currentTab === questions.length) {
        add(theme.fg("accent", theme.bold(" Ready to submit")));
        lines.push("");
        for (const question of questions) {
          const answer = answers.get(question.id);
          if (answer) {
            const prefix = answer.wasCustom ? "(wrote) " : "";
            add(
              `${theme.fg("muted", ` ${question.label}: `)}${theme.fg("text", prefix + answer.label)}`,
            );
          }
        }
        lines.push("");
        if (allAnswered()) {
          add(theme.fg("success", " Press Enter to submit"));
        } else {
          const missing = questions
            .filter((qq) => !answers.has(qq.id))
            .map((qq) => qq.label)
            .join(", ");
          add(theme.fg("warning", ` Unanswered: ${missing}`));
        }
      } else if (q) {
        add(theme.fg("text", ` ${q.prompt}`));
        lines.push("");
        renderOptions();
      }

      lines.push("");
      if (!inputMode) {
        const help = isMulti
          ? " Tab/←→ navigate • ↑↓ select • Enter confirm • Esc cancel"
          : " ↑↓ navigate • Enter select • Esc cancel";
        add(theme.fg("dim", help));
      }
      add(theme.fg("accent", "─".repeat(width)));

      cachedLines = lines;
      return lines;
    }

    return {
      render,
      invalidate: () => {
        cachedLines = undefined;
      },
      handleInput,
    };
  });
}

// ── Extension ──────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerCommand("clarify", {
    description: "Extract questions from last assistant message and present them via questionnaire",
    handler: async (_args, ctx) => {
      // 1. Get last assistant text
      const lastText = getLastAssistantText(ctx);
      if (!lastText) {
        ctx.ui.notify("No assistant message found.", "warning");
        return;
      }

      // 2. Resolve cheap model
      const cheapModelRef = parseCheapModel();
      if (!cheapModelRef) {
        ctx.ui.notify("CHEAP_MODEL not set. Expected format: provider/model-id", "error");
        return;
      }

      const model = ctx.modelRegistry.find(cheapModelRef.provider, cheapModelRef.modelId);
      if (!model) {
        ctx.ui.notify(
          `Model not found: ${cheapModelRef.provider}/${cheapModelRef.modelId}`,
          "error",
        );
        return;
      }

      const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
      if (!auth.ok) {
        ctx.ui.notify(`Auth failed: ${auth.error}`, "error");
        return;
      }
      if (!auth.apiKey) {
        ctx.ui.notify(`No API key for ${cheapModelRef.provider}/${cheapModelRef.modelId}`, "error");
        return;
      }

      // 3. Regex gate: skip LLM call if there are no question marks
      if (!hasQuestionMarks(lastText)) {
        ctx.ui.notify("No questions found in the last assistant message.", "warning");
        return;
      }

      ctx.ui.notify("Parsing questions from assistant message...", "info");

      // 4. Call cheap model to extract questions
      let questions: Question[] | undefined;
      try {
        const response = await complete(
          model,
          {
            messages: [
              {
                role: "user",
                content: [{ type: "text" as const, text: buildExtractPrompt(lastText) }],
                timestamp: Date.now(),
              },
            ],
          },
          {
            apiKey: auth.apiKey,
            headers: auth.headers,
            maxTokens: 4096,
          },
        );

        const rawText = response.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");

        questions = parseQuestions(rawText);
        if (!questions || questions.length === 0) {
          ctx.ui.notify("No questions found in the last assistant message.", "warning");
          return;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Cheap model failed: ${message}`, "error");
        return;
      }

      // 4. Show questionnaire
      const result = await runQuestionnaire(questions, ctx);
      if (result.cancelled) {
        ctx.ui.notify("Cancelled.", "info");
        return;
      }

      // 5. Send answers back as user message
      const answerLines = result.answers.map((a) => {
        const q = questions!.find((qq) => qq.id === a.id);
        const qLabel = q?.label ?? a.id;
        if (a.wasCustom) {
          return `${qLabel}: ${a.label}`;
        }
        return `${qLabel}: ${a.index}. ${a.label}`;
      });

      const userMessage = answerLines.join("\n");
      pi.sendUserMessage(userMessage);
    },
  });
}
