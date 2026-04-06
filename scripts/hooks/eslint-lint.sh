#!/bin/bash
set -euo pipefail

echo "=== ESLint (TypeScript) ==="
cd pi/.pi/agent/extensions
bunx eslint .
