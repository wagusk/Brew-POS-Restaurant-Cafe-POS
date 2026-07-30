#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT/frontend"
rm -rf dist
rm -f "$ROOT/.frontend-hash"
npm run build
HASH=$(find src -type f -print0 | sort -z | xargs -0 sha1sum 2>/dev/null | sha1sum | cut -d' ' -f1)
echo "$HASH" > "$ROOT/.frontend-hash"
echo "Frontend rebuilt."
