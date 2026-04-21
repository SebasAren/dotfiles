---
name: knowledge-audit
description: >
  Review the staleness and usefulness of rules and/or docs in .claude/rules/ and/or docs/domain/.
  Use this skill whenever the user wants to audit, clean up, or prune their knowledge base:
  "audit rules", "audit docs", "review rules for staleness", "clean up the rules", "are any docs outdated?",
  "prune old knowledge", "check if rules are still relevant", "knowledge audit", or any variation.
  Also trigger when the user says they're confused by a rule/doc that seems wrong — use that as the
  starting point for a broader audit.
---

# Knowledge Audit

Audit rule files (`.claude/rules/`) and domain docs (`docs/domain/`) for staleness, accuracy, and usefulness. Stale knowledge is worse than no knowledge — it sends sessions in the wrong direction.

## Scope Selection

When the user triggers this skill, determine scope:

| User says                                    | Scope      |
| -------------------------------------------- | ---------- |
| "audit rules", "check rules", "review rules" | Rules only |
| "audit docs", "check docs", "review docs"    | Docs only  |
| Ambiguous, "audit everything", "full audit"  | Both       |

If ambiguous, ask the user which scope to cover.

## Audit Process

### Step 1: Enumerate files

List all files in the target directories:

```bash
# Rules
ls .claude/rules/

# Docs
ls docs/domain/
```

### Step 2: Audit each file

For **each file**, load it with `read` and run through the [Audit Checklist](#audit-checklist). Record findings — don't rely on memory.

Process files in parallel groups where possible (multiple `read` calls in parallel, then process each).

### Step 3: Prioritize findings

Categorize all findings:

| Category           | Severity      | Action                                                               |
| ------------------ | ------------- | -------------------------------------------------------------------- |
| **CONTRADICTION**  | 🔴 Critical   | Rule/doc says X, code does Y. Must fix.                              |
| **DEAD REFERENCE** | 🔴 Critical   | References a file/API/config that no longer exists                   |
| **OBSOLETE**       | 🟡 Warning    | Feature was removed, pattern is no longer used, convention changed   |
| **DUPLICATE**      | 🟡 Warning    | Two files say essentially the same thing — merge or remove           |
| **STALE EXAMPLE**  | 🟡 Warning    | Code example uses deprecated APIs or old patterns                    |
| **VAGUE**          | 🟢 Suggestion | Too abstract to be useful — needs concrete examples or should be cut |
| **BLOAT**          | 🟢 Suggestion | Large file where most content is unused — trim or split              |
| **HEALTHY**        | ✅ No action  | Current, accurate, and useful                                        |

If findings are extensive, prioritize the 🔴 Critical items first when presenting.

### Step 4: Present findings

Show the audit summary grouped by file:

```markdown
## Knowledge Audit — [Rules | Docs | Rules & Docs]

| File               | Status            | Finding                                            |
| ------------------ | ----------------- | -------------------------------------------------- |
| `rules/auth.md`    | 🔴 Contradiction  | Says tokens expire in 24h, actual code uses 1h     |
| `rules/testing.md` | ✅ Healthy        | Up to date and referenced during work              |
| `docs/old-api.md`  | 🔴 Dead reference | References `/api/v1/` endpoint removed in refactor |
```

Files with no issues still get a row marked ✅ Healthy so the user sees what was checked.

### Step 5: Propose actions

For each non-healthy finding, propose a specific action:

- **Fix**: Edit the file to match reality (show the before/after)
- **Archive**: Move to `docs/archive/` or `docs/domain/archive/` with a date stamp
- **Merge**: Combine two similar files into one
- **Delete**: Remove entirely (for files where nothing is salvageable)
- **Trim**: Cut outdated sections, leave the good parts

## Audit Checklist

Apply these checks to every file:

### 🔍 Contradiction checks

- Does the file describe APIs, configs, or patterns that contradict what the codebase actually does?
- Cross-reference: `grep` for symbols, file paths, or API names mentioned in the file. Do they still exist?
- Check env vars, config keys, command names, and file paths — these are the most likely to drift.

### 🔍 Dead reference checks

- Does the file reference other files, modules, or directories that no longer exist?
- Does it mention env vars, npm packages, or CLI tools that have been removed?
- Check referenced `mise run` tasks — do they still exist? (`mise tasks ls`)

### 🔍 Obsolete pattern checks

- Does the file describe a pattern that's been replaced by a newer convention?
- Check for deprecated Vue/Nuxt/Prisma/tRPC patterns: Nuxt 2 syntax, Options API, Prisma 4→5 migrations, deprecated test framework patterns.
- Compare against the actual codebase — search for the described pattern and see if it's still used.

### 🔍 Duplicate checks

- Is any content substantially duplicated in another rule or doc?
- Duplicates create maintenance debt — when one gets updated and the other doesn't, they contradict.
- Common duplicates occur between `.claude/rules/` and `docs/domain/` for the same topic.

### 🔍 Example freshness checks

- Code examples: Do the APIs shown still exist in the current versions?
- Shell commands: Do they still work?
- Config snippets: Still valid syntax?

### 🔍 Usefulness checks

- Would this file actually help a future session? Be honest.
- Is it too vague to act on? ("Always write tests" without specifics)
- Is it so large nobody will read it? (Flags for splitting or archiving)

## Execution Guidelines

- **Be thorough but fair.** Don't flag minor style differences as contradictions. Focus on substantive accuracy issues.
- **Verify before flagging.** Before calling something a contradiction, actually check the code. Don't guess.
- **Cite evidence.** When flagging an issue, cite the specific line in the rule/doc AND the actual code that contradicts it.
- **Respect the docs vs rules distinction.** Rules (`.claude/rules/`) are auto-injected summaries. Docs (`docs/domain/`) are reference material. A rule should summarize; if it's longer than its corresponding doc, it may need trimming.
- **Check cross-references.** Rules often say "read `docs/domain/X.md` before implementing." Verify those docs exist and are current.
- **Batch reads.** When reading multiple files, do it in parallel — don't read one at a time unnecessarily.

## Applying Changes

After presenting findings, ask the user which actions to take. Apply approved changes:

- **Edits**: Use `edit` to update in place — keep diffs minimal and precise
- **Archives**: Move files with `mv`, preserving the original date
- **Merges**: Use `write` for the consolidated file, then remove the originals
- **Deletes**: Use `rm` only after explicit user approval

Present all changes before applying. Wait for user confirmation.

## Usage

```
/skill:knowledge-audit              # Audit both rules and docs
/skill:knowledge-audit rules        # Audit .claude/rules/ only
/skill:knowledge-audit docs         # Audit docs/domain/ only
```
