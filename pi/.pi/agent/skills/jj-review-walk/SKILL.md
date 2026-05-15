---
name: jj-review-walk
description: Interactive code review — the agent walks you through changes file by file, asking for your opinion on each. Use when the user says "walk me through", "let's review together", "review interactively", or wants a guided review session instead of an automated one.
---

# jj Interactive Review Walk-Through

Walk the user through a change file by file, asking for their judgment on each. The agent presents context and highlights, but the user makes all the calls — what to approve, what to flag, what to change.

## When to Activate

- User says "walk me through this change", "review together", "interactive review"
- `/skill:jj-review-walk <arg>` — the `<arg>` is **always a jj change ID** (full or partial). Resolve it: `jj log -r '<arg>' -T 'change_id.short()' --no-graph`
- User wants to be involved in the review decisions rather than getting a fully automated review

**Do NOT activate** when the user just says "review this" without the interactive qualifier — that routes to `/skill:jj-review` (automated) instead.

## Prerequisites

- `jj` must be installed and the repo must be a jj repo
- `jj-review` script at `~/.local/bin/jj-review` (from `jj` stow package)

## Workflow

### Step 1: Set up the brain session

```bash
jj-review <change-id>
```

Note the brain and duplicate IDs from the output.

### Step 2: Show the overview

Present a high-level summary before diving in:

```bash
jj log -r '<change-id>' -T 'description' --no-graph   # commit message
jj diff --stat                                          # file overview
```

Tell the user:
> This change touches **N files**. Here's the breakdown:
> - `file1.ext` — brief description of what changed
> - `file2.ext` — brief description of what changed
>
> Ready to walk through them one by one? We'll go in dependency order (config first, then scripts).

### Step 3: Walk through file by file

For each file:

1. **Read the full file** (not just the diff) to understand context
2. **Show the diff for that file** — `jj diff -- <path>`
3. **Present a summary** of what this file's changes do
4. **Highlight anything notable** — potential issues, design choices, questions worth asking — but do NOT categorize or judge. Present neutrally.
5. **Ask the user:**

> What do you think about this one? Anything you want to flag, change, or are we good to approve it?

6. **Wait for the user's response.** Based on what they say:
   - **"Looks good" / "approve" / "fine"** → move the file/hunks into the brain:
     ```bash
     jj squash --from @ --to @- -- <file>
     ```
   - **"I want to change X"** → help them edit the file, then move the approved version into the brain
   - **"Flag this" / "not sure about Y"** → note it as a finding (user decides the category), leave it in the duplicate for now
   - **"Skip for now"** → move on, leave it in the duplicate

7. **Show progress** after each file:
   ```bash
   jj diff --stat       # remaining
   jj show @- --stat    # brain so far
   ```

### Step 4: Summarize findings

When all files are reviewed (or the user wants to stop), compile the findings the user flagged:

```markdown
## Review Summary: <change description>

### Findings you flagged
- **`file.ext:line`** — <what you said about it>

### Approved and moved to brain
- `file1.ext`, `file2.ext`, ...

### Skipped / still in duplicate
- `file3.ext` — review later
```

Ask the user what they want to do with the flagged items — fix now, leave comments, or approve anyway.

### Step 5: Teardown

Based on the outcome:

```bash
# All approved, no changes made
jj-review --teardown

# Changes were made during review
jj-review --teardown --keep
```

## Pausing and resuming

If the user needs to stop mid-review:

> We're pausing here. **N files** remaining in the duplicate.
>
> To resume: `jj edit <dup-id>` then `/skill:jj-review-walk` again.

Print the brain and duplicate IDs so the user can resume later.

## Difference from automated review

| Aspect | `/skill:jj-review` (automated) | `/skill:jj-review-walk` (interactive) |
|--------|------|------|
| Who judges | Agent | User |
| Agent role | Reviewer — finds and categorizes issues | Guide — presents context, highlights trade-offs |
| Findings | Agent-generated, categorized 🔴🟡🟢 | User-generated, agent just records |
| Pace | Runs to completion | One file at a time, user-controlled |
| Best for | Quick automated pass, agent-generated code | Complex changes where you want to form your own opinion |

## Guidelines

- **Present, don't judge.** You're a guide, not the reviewer. Highlight trade-offs and let the user decide.
- **One file at a time.** Never show multiple files' diffs simultaneously. Let the user finish one before moving on.
- **Read full files.** Context matters. Show the relevant surrounding code, not just the diff hunks.
- **Keep the pace.** Don't over-explain obvious changes. If a file is trivial, say so quickly and ask for approval.
- **Respect the user's judgment.** If they say "fine", it's fine. Don't second-guess.
- **Track state.** After each file, note which files are approved, flagged, or skipped. Show a running count.

## Usage

```
/skill:jj-review-walk nx                    # Walk through change nx interactively
/skill:jj-review-walk kowqznzo              # Walk through change kowqznzo
```
