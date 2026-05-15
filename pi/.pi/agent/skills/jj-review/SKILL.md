---
name: jj-review
description: Local code review using the jj "brain" workflow. Set up review sessions, walk through diffs file-by-file, produce categorized review output. Use when the user says "review", "review this change", "jj-review", or wants to review a PR or local commit before merging.
---

# jj Local Review Skill

Review code locally using jj's brain workflow — review state lives in the commit graph, not a browser tab. The agent walks through the diff, categorizes findings, and produces a formatted review.

## When to Activate

- User says "review this", "review <change-id>", "jj-review"
- `/skill:jj-review <arg>` — the `<arg>` is **always a jj change ID** (full or partial like `nx`, `kowqznzo`). Resolve it immediately: `jj log -r '<arg>' -T 'change_id.short()' --no-graph`
- User wants to review a PR, agent-generated commit, or any local change
- User asks for help during an active review session

**Do NOT activate** for trivial changes (< 5 files, < 50 lines) — just review inline.

## Prerequisites

- `jj` must be installed and the repo must be a jj repo
- `jj-review` script at `~/.local/bin/jj-review` (from `jj` stow package)

## Workflow

### Step 1: Initiate the review

Ask the user for a change ID if not provided. Accepts:
- A single change ID (partial or full): `nx`, `kowqznzo`
- A range: `abc::def` (reviews the combined net diff of all commits in the range)

Then run:

```bash
jj-review <change-id>
jj-review <from>::<to>     # for multi-commit review
```

This duplicates the change(s), squashes into one if a range, inserts the brain commit, and prints next steps.

If the user already has an active review session, skip to Step 2.

### Step 2: Understand the change

Read the diff to understand what the change does:

```bash
jj diff --stat              # overview of files changed
jj diff                     # full diff for detailed review
```

Also check the commit message:

```bash
jj log -r '@' -T 'description' --no-graph
```

### Step 3: Review file by file

For each file in the diff, use the `read` tool to examine the full file for context. Do NOT review from the diff alone — read the surrounding code.

For each finding, classify into one of:

| Category | Emoji | Meaning |
|----------|-------|---------|
| **Must fix** | 🔴 | Bug, security issue, broken logic, will cause failure |
| **Suggestion** | 🟡 | Better approach, missing edge case, improvement opportunity |
| **Nit** | 🟢 | Style, naming, minor cleanup — discretionary |

For each finding, note:
- **File and line range**
- **What the issue is**
- **Why it matters** (one sentence)
- **Suggested fix** (concrete, not vague)

### Step 4: Move approved code into the brain

As you review, help the user move approved hunks/files:

```bash
# Move specific files into the brain
jj squash --from @ --to @- -- <file1> <file2>

# Or interactively select hunks
jj squash --interactive
```

**Note:** For range reviews, the duplicate is already squashed into one commit — the diff you see is the combined net change, not individual commits.

Track progress:

```bash
jj diff --stat        # remaining (unreviewed)
jj show @- --stat     # brain (reviewed so far)
```

### Step 5: Produce the review

When all code has been moved to the brain (or the user says they're done), generate a formatted review.

#### Determine the verdict

| Verdict | When |
|---------|------|
| **Request Changes** | Any 🔴 findings |
| **Comment** | Only 🟡 findings, no 🔴 |
| **Approve** | Only 🟢 findings, or no findings at all |

#### Format

```markdown
## Review: <change description>

**Verdict:** Request Changes / Comment / Approve

**Summary:** <1–2 sentence overview of what this change does and your assessment>

---

### 🔴 Must Fix

**`file.ts:42–55`** — <what>
<why it matters>
```suggestion
<concrete fix>
```

### 🟡 Suggestions

**`file.ts:88`** — <what>
<suggested alternative>

### 🟢 Nits

**`file.ts:12`** — <what>

---

**Files reviewed:** <count>/<total>
**Unreviewed remaining:** <list files or "none">
```

### Step 6: Teardown

Run the teardown command based on the outcome:

```bash
# If no changes were made during review (just approved as-is)
jj-review --teardown

# If changes were made (brain has your fixes)
jj-review --teardown --keep
```

### Pausing and resuming

Reviews can span multiple sessions. The review state is persisted in the commit graph.

```bash
# Pause — switch to other work
jj edit main

# Resume later
jj edit <duplicate-id>
```

The agent should remind the user of the change IDs when pausing.

## Guidelines

- **Read full files, not just diffs.** Context matters. A diff can look correct but be broken in context.
- **Be thorough but not pedantic.** Focus on correctness, edge cases, and maintainability. Don't bikeshed on naming unless it's genuinely confusing.
- **Categorize honestly.** Not everything is 🔴. If it works but could be better, that's 🟡. If it's just style, that's 🟢.
- **Give concrete suggestions.** "Consider a different approach" is useless. Show the code.
- **Respect "I just want to approve this."** If the user wants a quick pass, do a quick pass. Don't force a deep review on a trivial change.
- **The review is for the user.** The formatted output goes to terminal. Posting to GitHub is a future concern — the user can instruct the agent to do it ad-hoc.

## Usage

```
/skill:jj-review                        # Review current change
/skill:jj-review kowqznzo              # Review specific change
/skill:jj-review abc::def              # Review range of commits (combined diff)
/skill:jj-review --teardown            # Clean up review session
```
