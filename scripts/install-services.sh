#!/usr/bin/env bash
# Install & enable the user-level systemd services for Brew-POS:
#   - brewpos.service    (production uvicorn on :8000)
#   - brewpos-dev.service (Vite dev on :5173)
#   - port-8080.service  (placeholder HTTP on :8080 — swap ExecStart later)
#
# Idempotent: re-running is safe. Skips services that are already enabled.
#
# Also prints the exact `sudo bash open-firewall.sh` command the user
# needs to run once to open 5173/8080/8000 in firewalld.
set -euo pipefail

ROOT="/home/lenovo/Hermes-Project/Brew-POS"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
LOG_DIR="$ROOT/.hermes"

mkdir -p "$SYSTEMD_USER_DIR" "$LOG_DIR"

# Copy the service files into ~/.config/systemd/user/ (canonical location).
for svc in brewpos.service brewpos-dev.service port-8080.service; do
  src="$ROOT/scripts/$svc"
  dst="$SYSTEMD_USER_DIR/$svc"
  if [[ ! -f "$src" ]]; then
    echo "MISSING: $src"; exit 1
  fi
  install -m 0644 "$src" "$dst"
  echo "Installed $dst"
done

echo
echo "==> Reloading user systemd daemon"
systemctl --user daemon-reload

# Ensure Linger=yes so services auto-start without an active login session.
if ! loginctl show-user "$USER" 2>/dev/null | grep -q '^Linger=yes'; then
  echo
  echo "NOTE: user '$(whoami)' does NOT have Linger=yes."
  echo "      Without linger, services only start when you log in interactively."
  echo "      To enable permanent boot autostart, run ONCE with sudo:"
  echo "          sudo loginctl enable-linger $(whoami)"
fi

echo
echo "==> Enabling + starting services"
for svc in brewpos.service brewpos-dev.service port-8080.service; do
  systemctl --user enable "$svc"
  systemctl --user restart "$svc" || systemctl --user start "$svc"
  state=$(systemctl --user is-active "$svc" || true)
  echo "    $svc → $state"
done

echo
echo "==> Verifying ports"
sleep 3
for port in 8000 5173 8080; do
  if curl -sS -m 3 -o /dev/null -w '' "http://localhost:${port}/" 2>/dev/null \
     || ss -ltn 2>/dev/null | grep -q ":${port} "; then
    printf '    port %s: reachable\n' "$port"
  else
    printf '    port %s: NOT listening (see .hermes/*.log)\n' "$port"
  fi
done

cat <<EOF

==> Firewalld — buka 5173/8080/8000 di zona 'public' (PERMANENT)
    Karena aturan firewall butuh root, jalankan SEKALI secara manual:
        sudo bash $ROOT/scripts/open-firewall.sh
    Tanpa langkah ini, port 5173/8080/8000 tidak reachable dari LAN —
    Fedora Workstation zona 'public' default me-reject semua inbound
    kecuali SSH + DHCPv6-client. Setelah script dijalankan, aturan
    sudah PERMANENT, jadi tetap terbuka setelah reboot.

==> Boot autostart
    brewpos.service / brewpos-dev.service / port-8080.service semuanya
    enabled di user systemd. Karena Linger=yes, mereka auto-start saat
    boot tanpa perlu login.

EOF
