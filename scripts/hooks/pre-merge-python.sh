#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."

py_files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.py$' || true)
[ -z "$py_files" ] && exit 0

echo "=== Python Lint (ruff) ==="
echo "$py_files" | xargs mise exec -- ruff check

echo "=== Python Format Check ==="
echo "$py_files" | xargs mise exec -- ruff format --check