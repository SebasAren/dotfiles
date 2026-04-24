---
name: commit
description: Reflects on session findings, updates .claude/rules/ if needed, then commits using wt step commit. Use when asked to commit, when the user says "commit", or after completing a set of changes.
---

# Commit with Reflection

Before committing, reflect on the session and persist any valuable findings. Then create a clean commit using `wt step commit`.

## Step 1: Reflect on Findings

Review everything you did this session. Ask yourself:

- Did I discover any **gotchas** — unexpected behavior, non-obvious constraints, or things that would surprise future sessions?
- Did I find **misleading documentation**, **missing conventions**, or **undocumented patterns**?
- Did I encounter **recurring pitfalls** that are worth recording?
- Did I learn anything **project-specific** that isn't captured in existing rules?

If you found anything notable, present the findings to the user:

> I found some notable findings this session:
> - <list each finding as a bullet>
>
> Would you like me to persist these as rules in `.claude/rules/` for future sessions?
>
> - **Yes, save all**
> - **Let me choose which ones**
> - **No, skip**

- If the user answers **yes** → continue to Step 2 with all findings.
- If the user answers **pick** → present each finding as a numbered option so they can select which to keep.
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
- **Short rules are merge candidates** — Rules under ~300 bytes covering a single topic are better merged into a broader rule than kept as separate files. Avoid rule sprawl.
- **Rules vs skills heuristic** — Passive gotchas/conventions → rules. Action-oriented procedures (CLI workflows, how-to guides) → skills. Test: "Is this a warning or a procedure?"
- **File-specific notes go in AGENTS.md** — Detailed gotchas for specific files (e.g., performance constraints for 5 plugin files) belong in that directory's `AGENTS.md`, not as a global rule. Rules should be for cross-project patterns.

## Step 3: Stage and Commit with wt

Use `wt step commit` which:
- Stages all changes automatically
- Runs `pre-commit` hooks (lua-format, shell-lint as defined in `.config/wt.toml`)
- Generates a conventional commit message
- Commits with the generated message

```bash
wt step commit --yes
```

The `--yes` flag is required in non-interactive environments (like AI agents) to auto-approve hook commands.

If there are unrelated changes you don't want to commit, stage selectively first:

```bash
git add <specific-files>
wt step commit --yes
```

## Usage

```
/commit                           # Reflect, update rules, then commit via wt
```
