#!/usr/bin/env bash
# Generate a commit message from a diff passed via stdin.
# Used by wt's squash commit generation.
set -euo pipefail

prompt="Output only a commit message. No quotes, no code blocks, no explanation."
tmpfile=$(mktemp)
trap 'rm -f "$tmpfile"' EXIT

# wt pipes the squash diff to stdin; pi reads it as the prompt argument
diff_text=$(cat)

pi -p \
  --model "${CHEAP_MODEL:-}" \
  --no-tools --no-extensions --no-skills --no-session --no-prompt-templates \
  --append-system-prompt <(echo "$prompt") \
  "$diff_text"
