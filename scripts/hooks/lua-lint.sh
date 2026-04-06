#!/bin/bash
set -euo pipefail

echo "=== Lua Lint (luacheck) ==="
mise exec -- luacheck --config nvim/.config/nvim/.luacheckrc nvim/.config/nvim/lua/ 2>/dev/null || true
