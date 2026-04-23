#!/bin/bash
set -euo pipefail

REPO_ROOT="${WT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"

echo "=== Bun Tests (extensions) ==="
cd "$REPO_ROOT/pi/.pi/agent/extensions"
bun test

echo "=== Bun Tests (tdd-plan) ==="
bun test "$REPO_ROOT/pi/.local/bin/tdd-plan.test.ts"
