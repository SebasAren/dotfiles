#!/bin/bash
set -euo pipefail

py_files=$(find . -name "*.py" -not -path "*/node_modules/*" -type f 2>/dev/null || true)
[ -z "$py_files" ] && exit 0

echo "=== Python Lint (ruff) ==="
echo "$py_files" | xargs mise exec -- ruff check

echo "=== Python Format Check (ruff) ==="
echo "$py_files" | xargs mise exec -- ruff format --check
