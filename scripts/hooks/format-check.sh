#!/bin/bash
set -euo pipefail

echo "=== Format Check: Staged Files ==="

staged() { git diff --cached --name-only --diff-filter=ACM | grep -E "$1" || true; }

# Lua: StyLua auto-format
lua_files=$(staged '\.lua$')
if [ -n "$lua_files" ]; then
    echo "Formatting Lua files with StyLua..."
    echo "$lua_files" | xargs stylua
    echo "$lua_files" | xargs git add
fi

# Shell: shellcheck on staged scripts
shell_files=$(staged '\.(sh|bash)$')
if [ -n "$shell_files" ]; then
    echo "Linting shell scripts with shellcheck..."
    echo "$shell_files" | xargs mise exec -- shellcheck
fi

# Python: ruff auto-format
py_files=$(staged '\.py$')
if [ -n "$py_files" ]; then
    echo "Formatting Python files with ruff..."
    echo "$py_files" | xargs mise exec -- ruff format
    echo "$py_files" | xargs git add
fi

# TypeScript: Prettier auto-format
ts_files=$(staged '\.(ts|tsx)$')
if [ -n "$ts_files" ]; then
    echo "Formatting TypeScript files with Prettier..."
    echo "$ts_files" | xargs mise exec -- prettier --write
    echo "$ts_files" | xargs git add
fi

echo "=== Format checks passed ==="