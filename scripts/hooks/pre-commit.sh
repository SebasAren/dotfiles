#!/bin/bash
set -euo pipefail

echo "=== Pre-commit Hook: Formatting & Quick Checks ==="

# Lua: StyLua format check
lua_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.lua$' || true)
if [ -n "$lua_files" ]; then
    echo "Checking Lua files with StyLua..."
    echo "$lua_files" | xargs stylua --check
fi

# Shell: shellcheck on staged scripts
shell_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(sh|bash)$' || true)
if [ -n "$shell_files" ]; then
    echo "Linting shell scripts with shellcheck..."
    echo "$shell_files" | xargs mise exec -- shellcheck
fi

# Python: ruff format check (fast)
py_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)
if [ -n "$py_files" ]; then
    echo "Checking Python files with ruff..."
    echo "$py_files" | xargs mise exec -- ruff format --check
fi

echo "=== Pre-commit checks passed ==="