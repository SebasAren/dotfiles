#!/bin/bash
set -euo pipefail

files=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(sh|bash)$' || true)
if [ -n "$files" ]; then
    echo "$files" | xargs mise exec -- shellcheck
fi
