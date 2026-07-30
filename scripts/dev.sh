#!/usr/bin/env bash
# Dev mode — runs backend (8000) + frontend vite dev (5173) concurrently.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

VENV="$ROOT/.venv"
if [[ ! -d "$VENV" ]]; then
  python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"

if [[ ! -f "$VENV/.deps_installed" ]]; then
  pip install -r requirements.txt
  touch "$VENV/.deps_installed"
fi

# Seed DB if missing
[[ -f "$ROOT/backend/brewpos.db" ]] || (cd "$ROOT/backend" && python -m app.db.seed)

# Start backend
(cd "$ROOT/backend" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACK_PID=$!

# Start frontend
(cd "$ROOT/frontend" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONT_PID=$!

trap 'kill $BACK_PID $FRONT_PID 2>/dev/null || true' EXIT INT TERM
echo "Backend: http://localhost:8000  Frontend: http://localhost:5173"
wait
