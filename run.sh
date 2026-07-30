#!/usr/bin/env bash
# Brew-POS — one-command portable run.
# Builds frontend, then starts backend serving the static UI on http://localhost:8000
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- Backend setup (idempotent) ---
VENV="$ROOT/.venv"
if [[ ! -d "$VENV" ]]; then
  echo "==> Creating Python venv"
  python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"

if [[ ! -f "$VENV/.deps_installed" ]] || [[ requirements.txt -nt "$VENV/.deps_installed" ]]; then
  echo "==> Installing backend dependencies"
  pip install --upgrade pip >/dev/null
  pip install -r requirements.txt
  touch "$VENV/.deps_installed"
fi

# --- Frontend build (only if missing or source changed) ---
DIST="$ROOT/frontend/dist"
INDEX="$DIST/index.html"
PKG_HASH="$ROOT/.frontend-hash"
CUR_HASH=$(find "$ROOT/frontend/src" -type f -print0 2>/dev/null | sort -z | xargs -0 sha1sum 2>/dev/null | sha1sum | cut -d' ' -f1,2)
if [[ ! -f "$INDEX" ]] || [[ ! -f "$PKG_HASH" ]] || [[ "$CUR_HASH" != "$(cat "$PKG_HASH" 2>/dev/null)" ]]; then
  echo "==> Building frontend"
  cd "$ROOT/frontend"
  if [[ ! -d node_modules ]]; then
    npm install
  fi
  npm run build
  cd "$ROOT"
  echo "$CUR_HASH" > "$PKG_HASH"
else
  echo "==> Frontend already built (use ./scripts/rebuild-frontend.sh to force)"
fi

# --- Seed DB (if empty) ---
if [[ ! -f "$ROOT/backend/brewpos.db" ]]; then
  echo "==> Seeding database"
  cd "$ROOT/backend"
  python -m app.db.seed
  cd "$ROOT"
fi

# --- Launch ---
HOST="${BREWPOS_HOST:-0.0.0.0}"
PORT="${BREWPOS_PORT:-8000}"
echo "==> Brew-POS running on http://$HOST:$PORT"
exec uvicorn app.main:app --app-dir "$ROOT/backend" --host "$HOST" --port "$PORT"
