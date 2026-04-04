---
name: commit
description: Reflects on session findings, updates .claude/rules/ if needed, then stages and commits changes with a conventional commit message. Use when asked to commit, when the user says "commit", or after completing a set of changes.
---

# Commit with Reflection

Before committing, reflect on the session and persist any valuable findings. Then create a clean conventional commit.

## Step 1: Reflect on Findings

Review everything you did this session. Ask yourself:

- Did I discover any **gotchas** — unexpected behavior, non-obvious constraints, or things that would surprise future sessions?
- Did I find **misleading documentation**, **missing conventions**, or **undocumented patterns**?
- Did I encounter **recurring pitfalls** that are worth recording?
- Did I learn anything **project-specific** that isn't captured in existing rules?

If you found anything notable, use the **questionnaire** tool to ask the user:

```
questionnaire({
  questions: [{
    id: "store-findings",
    prompt: "I found some notable findings this session:\n\n<list each finding as a bullet>\n\nWould you like me to persist these as rules in .claude/rules/ for future sessions?",
    label: "Rules",
    options: [
      { value: "yes", label: "Yes, save all" },
      { value: "pick", label: "Let me choose which ones" },
      { value: "no", label: "No, skip" }
    ]
  }]
})
```

- If the user answers **yes** → continue to Step 2 with all findings.
- If the user answers **pick** → ask a follow-up questionnaire with one option per finding so they can select which to keep.
- If the user answers **no** → skip to Step 3.

If **nothing notable** was found, skip directly to Step 3.

## Step 2: Update or Create Rules

Persist findings in `.claude/rules/` so future sessions benefit from them.

### Check Existing Rules First

1. Read all files in `.claude/rules/` to see what's already covered
2. Decide: does the finding belong in an **existing rule file** or does it need a **new one**?

### Update Existing Rule

If the finding fits an existing rule (e.g., a new Python convention goes in `python.md`), append it to that file's body. Do not duplicate what's already there.

### Create New Rule

If the finding is a new category, create a new `.claude/rules/<slug>.md` file:

```markdown
---
description: Short description of what this rule covers
---

- Finding 1: concise description
- Finding 2: concise description
```

For path-scoped rules (only relevant when touching certain files):

```markdown
---
globs:
  - "pattern/**/*.ext"
description: What this rule covers
---

- Finding 1: concise description
```

### Rules for Rules

- **One topic per file** — don't lump unrelated findings together
- **Keep it concise** — bullet points, not essays
- **Be specific** — "Widget bars need `importlib` imports" not "imports can be tricky"
- **Use `globs`** when findings only apply to specific file patterns
- **No globs** when findings are general project knowledge

## Step 3: Stage and Commit

### Stage Changes

```bash
git add -A
```

Or selectively stage only relevant files if unrelated changes exist.

### Craft Commit Message

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]
[optional footer(s)]
```

**Types:**
- `feat` — new feature or significant addition
- `fix` — bug fix or correction
- `refactor` — code restructuring without behavior change
- `docs` — documentation changes
- `style` — formatting, whitespace (no logic change)
- `chore` — maintenance, tooling, build changes
- `perf` — performance improvement
- `test` — adding or updating tests

**Scope:** the tool or area affected (e.g., `nvim`, `qtile`, `docker`, `tmux`).

**Guidelines:**
- Use **imperative mood** in subject: "add plugin" not "added plugin"
- Keep subject under **72 characters**
- Only add a body if the subject alone isn't clear enough
- **Atomic commits** — one logical change per commit

### Execute

```bash
git commit -m "<type>(<scope>): <description>"
```

## Usage

```
/commit                           # Reflect, update rules, then commit
/commit feat(nvim): add blink.cmp # Skip message generation, just reflect + commit
```
