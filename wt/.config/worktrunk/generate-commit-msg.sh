#!/usr/bin/env bash
# Generate a commit message from a diff passed via stdin.
# Used by wt's squash commit generation.
#
# This script uses pi (AI coding assistant) to generate a commit message.
# If pi fails (timeout, missing API key, network error), it falls back to
# a generic commit message based on the diff stats.
#
# Required environment variables:
#   - MIMO_API_KEY for xiaomi-mimo/* models
#   - GEMINI_API_KEY or Google OAuth for google/* models
#
# The CHEAP_MODEL variable (sourced from ~/.bashrc.d/pi_models) determines
# which model to use. If empty, pi uses its default model.
set -euo pipefail

# Source pi model settings if available (CHEAP_MODEL may be defined there)
if [[ -f ~/.bashrc.d/pi_models ]]; then
  source ~/.bashrc.d/pi_models
fi

prompt="You must output a single-line commit message in conventional commits format, starting with a type (e.g., feat, fix, chore, refactor, docs, style, test, ci, build, perf, etc.) followed by a colon and a space, then a concise description. Example: 'chore: remove obsolete configs'. Output only the commit message, nothing else. No quotes, no code blocks, no explanation, no bullet points."

# wt pipes the squash diff to stdin; pi reads it as the prompt argument
diff_text=$(cat)

# Timeout for pi command (seconds)
TIMEOUT=30

# Check for missing API key for common providers
if [[ -n "${CHEAP_MODEL:-}" ]]; then
  case "$CHEAP_MODEL" in
    xiaomi-mimo/*)
      if [[ -z "${MIMO_API_KEY:-}" ]]; then
        echo "WARNING: MIMO_API_KEY environment variable is not set." >&2
        echo "Pi will fail to authenticate. Set MIMO_API_KEY in your environment or auth.json." >&2
        echo "Example: export MIMO_API_KEY=your-key  (add to ~/.bashrc.d/pi_models)" >&2
      fi
      ;;
    google/*)
      if [[ -z "${GEMINI_API_KEY:-}" ]] && [[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]]; then
        echo "WARNING: No Google API key found." >&2
        echo "Run 'pi /login' to authenticate with Google Gemini CLI (free)." >&2
      fi
      ;;
  esac
fi

# Temporary file for pi output
tmp_out=$(mktemp)
trap 'rm -f "$tmp_out"' EXIT

# Build pi command arguments
pi_args=("-p" "--no-tools" "--no-extensions" "--no-skills" "--no-session" "--no-prompt-templates" "--thinking" "off" "--system-prompt" <(echo "$prompt"))
if [[ -n "${CHEAP_MODEL:-}" ]]; then
  pi_args+=("--model" "$CHEAP_MODEL")
fi

# Run pi with timeout, capture stdout and stderr
if timeout "$TIMEOUT" pi "${pi_args[@]}" "$diff_text" > "$tmp_out" 2>&1; then
  # pi succeeded, read output
  commit_msg=$(cat "$tmp_out")
  # Trim whitespace and take first line
  commit_msg=$(echo "$commit_msg" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' | head -1)
  # Ensure output is not empty
  if [[ -n "$commit_msg" ]]; then
    # Validate conventional commit format
    if ! [[ "$commit_msg" =~ ^[a-z]+(:|\([a-z]+\)?:) ]]; then
      # Not a conventional commit, prepend 'chore: '
      commit_msg="chore: $commit_msg"
    fi
    echo "$commit_msg"
    exit 0
  fi
fi

# If we reach here, pi failed or produced empty output
# Log error to stderr (visible in wt logs)
echo "WARNING: pi failed to generate commit message (timeout or error)." >&2
echo "Falling back to generic commit message." >&2

# Fallback: generate a simple commit message based on diff stats
# Count number of files changed (ignore grep exit code)
files_changed=$(echo "$diff_text" | grep -c '^diff --git' || echo 0)
if [[ $files_changed -eq 0 ]]; then
  echo "Update"
elif [[ $files_changed -eq 1 ]]; then
  # Extract filename from first diff header
  filename=$(echo "$diff_text" | grep -m1 '^diff --git' | sed 's|^diff --git a/||;s| b/.*||')
  echo "Update $filename"
else
  echo "Update $files_changed files"
fi