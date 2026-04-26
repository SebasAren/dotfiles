#!/usr/bin/env bash
set -euo pipefail

# Extract mise pi version (e.g. pi = "0.70.2")
mise_version=$(grep -E '^\s*pi\s*=' mise/.config/mise/config.toml | sed -E 's/.*=\s*"([^"]+)".*/\1/')
if [ -z "$mise_version" ]; then
  echo "ERROR: Could not extract pi version from mise/.config/mise/config.toml"
  exit 1
fi

# Extract npm pi package version from package.json (e.g. ^0.70.2 -> 0.70.2)
npm_version=$(grep -E '"@mariozechner/pi-(ai|coding-agent|tui|agent-core)"' pi/.pi/agent/extensions/package.json | head -1 | sed -E 's/.*"\^?([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
if [ -z "$npm_version" ]; then
  echo "ERROR: Could not extract pi package version from pi/.pi/agent/extensions/package.json"
  exit 1
fi

if [ "$mise_version" != "$npm_version" ]; then
  echo "ERROR: Version mismatch between mise and npm packages"
  echo "  mise/.config/mise/config.toml:      pi = $mise_version"
  echo "  pi/.pi/agent/extensions/package.json: @mariozechner/pi-* = ^$npm_version"
  exit 1
fi

echo "OK: mise pi ($mise_version) matches npm packages ($npm_version)"
