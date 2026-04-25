#!/usr/bin/env bash
# Generate a commit message from the prompt wt sends via stdin.
# Used by wt's squash/commit generation.
#
# wt sends its own built-in prompt (task, format, style, diff, context)
# to stdin. We just need to pipe it to pi and return the output.
set -euo pipefail

# Source pi model settings if available
if [[ -f ~/.bashrc.d/pi_models ]]; then
# shellcheck source=/dev/null
  source ~/.bashrc.d/pi_models
fi

# Read wt's full prompt from stdin
prompt=$(cat)

# Prepend conventional commit format instructions so pi generates proper format
conventional_prefix='IMPORTANT: Your output is used directly as the git commit message.
You MUST use Conventional Commits format: <type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
Do NOT wrap output in code fences. Output ONLY the commit message, nothing else.

'
prompt="${conventional_prefix}${prompt}"

# Build pi arguments
pi_args=("-p" "--no-tools" "--no-extensions" "--no-skills" "--no-session" "--no-prompt-templates" "--thinking" "off")
if [[ -n "${CHEAP_MODEL:-}" ]]; then
  pi_args+=("--model" "$CHEAP_MODEL")
fi

# Temporary file for pi output
tmp_out=$(mktemp)
trap 'rm -f "$tmp_out"' EXIT

# Run pi with timeout, capture output
if timeout 30 pi "${pi_args[@]}" "$prompt" > "$tmp_out" 2>&1; then
  commit_msg=$(cat "$tmp_out")
  # Trim leading/trailing blank lines
  commit_msg=$(echo "$commit_msg" | sed -e '/./,$!d' -e ':a' -e '/^\n*$/{$d;N;ba}')
  if [[ -n "$commit_msg" ]]; then
    echo "$commit_msg"
    exit 0
  fi
fi

# Fallback: generate conventional commit message from diff stats in the prompt
echo "WARNING: pi failed to generate commit message." >&2
files_changed=$(echo "$prompt" | grep -c '^diff --git' || echo 0)
if [[ $files_changed -eq 0 ]]; then
  echo "chore: update"
elif [[ $files_changed -eq 1 ]]; then
  filename=$(echo "$prompt" | grep -m1 '^diff --git' | sed 's|^diff --git a/||;s| b/.*||')
  echo "chore: update $filename"
else
  echo "chore: update $files_changed files"
fi
