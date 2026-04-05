#!/bin/bash
set -euo pipefail

EXT_DIR="pi/.pi/agent/extensions"
cd "$EXT_DIR"

echo "=== TypeScript Type Check ==="
for dir in */; do
    [ -f "$dir/tsconfig.json" ] || continue
    echo "Checking $dir..."
    bunx tsc --noEmit -p "$dir/tsconfig.json"
done

echo "=== TypeScript Format Check (Prettier) ==="
bunx prettier --check "**/*.{ts,tsx}"
