---
name: linear
description: Interact with Linear issues via the `linear` CLI. Use to read issue details, list/query issues, and post comments (questions, findings). Activate when the user mentions a Linear issue ID, asks about their issues, or wants to report findings back to Linear.
---

# Linear Issue Tracker Integration

Uses [schpet/linear-cli](https://github.com/schpet/linear-cli) to interact with Linear from the terminal and Pi agent.

## Setup

Authentication is handled via `LINEAR_API_KEY` env var, resolved through the Proton Pass secrets pattern. Ensure:

1. API key exists in Proton Pass at `API/Linear/API Key`
2. `linear auth whoami` confirms authentication

If auth fails, tell the user to run `linear auth login` or add the key to Proton Pass.

## Commands

All commands are run via the `bash` tool. Use `--json` flag when you need structured output for parsing.

### View an issue

```bash
linear issue view ABC-123            # Human-readable output
linear issue view ABC-123 --json     # JSON for programmatic use
```

### List issues

```bash
linear issue mine                     # Your unstarted issues
linear issue query --state unstarted  # Unstarted across team
linear issue query --search "keyword" # Full-text search
linear issue query --json             # JSON output for parsing
```

### Post a comment

```bash
linear issue comment add ABC-123 --body "Comment text here"
```

For multi-line or markdown comments, write to a temp file first:

```bash
cat > /tmp/linear-comment.md << 'EOF'
## Findings

- Finding 1
- Finding 2

## Questions

- Question 1?
EOF
linear issue comment add ABC-123 --body-file /tmp/linear-comment.md
```

### Get issue URL (for reference)

```bash
linear issue url ABC-123
```

## When to Use

### On-demand (user asks)

- User mentions an issue ID (e.g. "look at ABC-123") → read it with `linear issue view`
- User asks about their workload → `linear issue mine`
- User says "report findings to ABC-123" → post a comment

### Proactive (during work)

- When starting work on a task that has a Linear issue ID in the branch name or context, read the issue for background
- After completing significant work, offer to comment on the relevant Linear issue with a summary

## Comment Style

When posting comments on behalf of the user:

- Start with a brief header indicating it's from the agent (e.g. `## Agent Notes` or `## Questions from coding session`)
- Be factual and concise — describe findings, not the process
- For questions, be specific and actionable
- For findings, include file paths and line numbers when relevant
- Use markdown for readability

## Out of Scope

The agent does **not**:

- Change issue status (start, complete, cancel)
- Create or merge PRs
- Create branches (that's handled by the user via `wt`)
- Delete issues or comments

These are handled by the user directly or through Linear's GitHub integration.
