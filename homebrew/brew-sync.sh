#!/usr/bin/env bash
# Regenerate the personal Brewfile by diffing installed packages against
# Bluefin's system Brewfiles. Only packages NOT in the system Brewfiles
# are included.
#
# Usage: brew-sync.sh [output-path]
#   output-path defaults to the Brewfile next to this script.
#   Also available as the `brewsync` alias.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="${1:-$SCRIPT_DIR/Brewfile}"
SYSTEM_DIR="/usr/share/ublue-os/homebrew"

if [[ ! -d "$SYSTEM_DIR" ]]; then
  echo "Warning: System Brewfiles not found at $SYSTEM_DIR" >&2
  echo "Generating full Brewfile without diffing." >&2
  SYSTEM_FORMULAS=""
  SYSTEM_CASKS=""
else
  SYSTEM_FORMULAS=$(cat "$SYSTEM_DIR"/*.Brewfile 2>/dev/null \
    | grep -E '^brew ' | sed "s/^brew ['\"]//;s/['\"].*$//" | sort -u)
  SYSTEM_CASKS=$(cat "$SYSTEM_DIR"/*.Brewfile 2>/dev/null \
    | grep -E '^cask ' | sed "s/^cask ['\"]//;s/['\"].*$//" | sort -u)
fi

# Get top-level (explicitly installed) formulas
LEAVES=$(brew leaves 2>/dev/null | sort)

# Filter out system-managed formulas
PERSONAL_FORMULAS=$(comm -23 <(echo "$LEAVES") <(echo "$SYSTEM_FORMULAS" | sort))

# Get installed casks, filter system-managed
INSTALLED_CASKS=$(brew list --cask -1 2>/dev/null | sort)
PERSONAL_CASKS=$(comm -23 <(echo "$INSTALLED_CASKS") <(echo "$SYSTEM_CASKS" | sort))

# Generate Brewfile
cat > "$OUTPUT" << 'HEADER'
# Personal Homebrew packages (not managed by Bluefin system Brewfiles)
# Regenerate: `ujust brew-sync` or `brew-sync.sh`
#
# These are explicitly installed packages that aren't in:
#   /usr/share/ublue-os/homebrew/*.Brewfile

HEADER

if [[ -n "$PERSONAL_FORMULAS" ]]; then
  echo "# CLI tools & development" >> "$OUTPUT"
  while IFS= read -r pkg; do
    echo "brew \"$pkg\"" >> "$OUTPUT"
  done <<< "$PERSONAL_FORMULAS"
  echo "" >> "$OUTPUT"
fi

if [[ -n "$PERSONAL_CASKS" ]]; then
  echo "# Fonts & GUI apps" >> "$OUTPUT"
  while IFS= read -r pkg; do
    echo "cask \"$pkg\"" >> "$OUTPUT"
  done <<< "$PERSONAL_CASKS"
fi

COUNT_F=$(echo "$PERSONAL_FORMULAS" | grep -c . || true)
COUNT_C=$(echo "$PERSONAL_CASKS" | grep -c . || true)
echo "Brewfile updated: $OUTPUT ($COUNT_F formulas, $COUNT_C casks)"
