#!/usr/bin/env bash
# Tiny TCP listener on a port — placeholder service so the port is always
# reachable after boot. Swap BREWPOS_PORT_8080_CMD env var to point at
# your actual application. Default serves /tmp on port 8080.
#
# Used by scripts/port-8080.service via /usr/bin/env.
set -euo pipefail

PORT="${BREWPOS_PORT_8080:-8080}"
ROOT="${BREWPOS_PORT_8080_ROOT:-/tmp}"
LOG="${BREWPOS_PORT_8080_LOG:-/home/lenovo/Hermes-Project/Brew-POS/.hermes/port-8080.log}"

echo "[$(date -Is)] listening on 0.0.0.0:${PORT}, serving ${ROOT}" | tee -a "$LOG"
exec python3 -m http.server "${PORT}" --bind 0.0.0.0 --directory "${ROOT}" 2>&1 | tee -a "$LOG"
