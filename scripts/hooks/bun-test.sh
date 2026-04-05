#!/bin/bash
set -euo pipefail

echo "=== Bun Tests ==="
cd pi/.pi/agent/extensions
bun test
