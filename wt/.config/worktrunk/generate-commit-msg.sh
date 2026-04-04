#!/usr/bin/env bash
# Generate a commit message from a diff passed via stdin.
# Used by wt's squash commit generation.
set -euo pipefail

# Source pi model settings if available (CHEAP_MODEL may be defined there)
if [[ -f ~/.bashrc.d/pi_models ]]; then
  source ~/.bashrc.d/pi_models
fi

prompt="Output only a commit message. No quotes, no code blocks, no explanation."

# wt pipes the squash diff to stdin; pi reads it as the prompt argument
diff_text=$(cat)

pi -p \
  --model "${CHEAP_MODEL:-}" \
  --no-tools --no-extensions --no-skills --no-session --no-prompt-templates \
  --thinking off \
  --append-system-prompt <(echo "$prompt") \
  "$diff_text"

