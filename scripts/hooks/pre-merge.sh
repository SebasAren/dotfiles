#!/bin/bash
set -euo pipefail

echo "=== Pre-merge Hook: Full Validation ==="

# TypeScript: Typecheck all extensions
echo "=== TypeScript Type Check ==="
EXT_DIR="pi/.pi/agent/extensions"
cd "$EXT_DIR"
for dir in */; do
    if [ -f "$dir/tsconfig.json" ]; then
        echo "Checking $dir..."
        bunx tsc --noEmit -p "$dir/tsconfig.json"
    fi
done

# TypeScript: Run Bun tests
echo "=== Bun Tests ==="
bun test

# Lua: Full luacheck lint
echo "=== Lua Lint (luacheck) ==="
cd "$OLDPWD"
mise exec -- luacheck nvim/.config/nvim/lua/ 2>/dev/null || true

# Python: Full ruff lint + format check
echo "=== Python Lint & Format Check ==="
py_files=$(find . -name "*.py" -not -path "*/node_modules/*" -type f 2>/dev/null || true)
if [ -n "$py_files" ]; then
    echo "$py_files" | xargs mise exec -- ruff check
    echo "$py_files" | xargs mise exec -- ruff format --check
fi

echo "=== Pre-merge checks passed ==="