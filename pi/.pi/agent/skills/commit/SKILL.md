---
name: commit
description: Reflects on session findings, updates .claude/rules/ if needed, then commits using wt step commit. Use when asked to commit, when the user says "commit", or after completing a set of changes.
---

# Commit with Reflection

Before committing, reflect on the session and persist any valuable findings. Then create a clean commit using `wt step commit`.

## Step 1: Reflect on Findings

Review everything you did this session. A finding earns a rule only if it falls into one of two narrow categories:

1. **External constraints not visible in code** — env vars, CI quirks, version gates, vendor API limits, system-binary requirements, undocumented SDK shapes.
2. **Design decisions whose absence would invite churn** — conventions a future contributor would otherwise undo (e.g. "system prompt is declarative — no ALL CAPS register").

**Derivability test**: if an agent could learn the finding by reading one file, it is *not* a rule. The code is already authoritative — duplicating it in `.claude/rules/` just creates a second source of truth that will rot.

If you found anything that clears the bar, present the findings to the user:

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

### What does NOT belong as a rule

- **Implementation details derivable from the code** — scoring weights, tier thresholds, what a regex captures, which fields a function reads. The code is the source of truth; rules duplicating it rot the moment the code changes.
- **Ephemeral fix recipes** — "I changed X to Y to fix Z." The fix is in the diff; the rationale is in the commit message.
- **Anything already in `AGENTS.md` / `README.md` / `CONVENTIONS.md`** — before adding a rule, grep these. A third copy is a third thing to keep in sync.
- **Historical narrative** — "post-2025-04 redesign", "we used to do X". Rules describe the current invariant, not the journey.

### Prune as you go

Rules age out. When editing an existing rule file, scan it for entries that have decayed into implementation detail (the code now obviously expresses them) or contradict the current code, and delete them in the same commit. A pruned rule file is more valuable than a comprehensive one — every stale bullet costs context on every load.

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
