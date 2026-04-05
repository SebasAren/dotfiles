#!/bin/bash
set -euo pipefail

echo "=== Lua Lint (luacheck) ==="
mise exec -- luacheck nvim/.config/nvim/lua/ 2>/dev/null || true
