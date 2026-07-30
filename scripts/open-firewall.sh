#!/usr/bin/env bash
# Buka port-port Brew-POS dev/prod di firewalld Fedora.
#
# - 8000  → Brew-POS production (uvicorn + static dist)
# - 5173  → Brew-POS Vite dev server (npm run dev) — hot reload
# - 8080  → Generic dev port (override via BREWPOS_EXTRA_PORTS env)
#
# Jalankan SATU KALI dengan sudo:
#   sudo bash /home/lenovo/Hermes-Project/Brew-POS/scripts/open-firewall.sh
#
# Aturan ditulis ke konfigurasi PERMANENT firewalld — tetap terbuka
# setelah reboot (zona 'public' Fedora default me-reject semua inbound
# kecuali SSH/DHCP, jadi tanpa script ini LAN cuma bisa SSH).
set -euo pipefail

ZONE="${BREWPOS_FIREWALL_ZONE:-public}"
PORTS=()
[[ -n "${BREWPOS_PORT:-}"    ]] && PORTS+=("${BREWPOS_PORT}")
# Brew-POS defaults — production (8000), Vite dev (5173), and a generic
# 8080 dev port. These are always opened by the script; add more via
# BREWPOS_EXTRA_PORTS.
PORTS+=("8000")
PORTS+=("5173")
PORTS+=("8080")
if [[ -n "${BREWPOS_EXTRA_PORTS:-}" ]]; then
  # comma-separated, e.g. BREWPOS_EXTRA_PORTS=9000,9100
  IFS=',' read -r -a extras <<< "${BREWPOS_EXTRA_PORTS}"
  PORTS+=("${extras[@]}")
fi

# De-dupe
uniq_ports=()
declare -A seen=()
for p in "${PORTS[@]}"; do
  [[ -z "$p" ]] && continue
  [[ -n "${seen[$p]:-}" ]] && continue
  seen[$p]=1
  uniq_ports+=("$p")
done
PORTS=("${uniq_ports[@]}")

if ! command -v firewall-cmd >/dev/null 2>&1; then
  echo "firewall-cmd tidak ditemukan — firewall nonaktif atau distro lain. Skip."
  exit 0
fi

if ! systemctl is-active --quiet firewalld; then
  echo "firewalld tidak aktif — tidak perlu buka port di firewall."
  exit 0
fi

echo "==> Membuka ${#PORTS[@]} port tcp di zona '${ZONE}' (runtime + permanent):"
printf '    - %s/tcp\n' "${PORTS[@]}"
echo

for port in "${PORTS[@]}"; do
  firewall-cmd --zone="${ZONE}" --add-port="${port}/tcp"
  firewall-cmd --zone="${ZONE}" --add-port="${port}/tcp" --permanent
done

echo
echo "==> Runtime ports (${ZONE}):"
firewall-cmd --zone="${ZONE}" --list-ports
echo
echo "==> Permanent ports (${ZONE}):"
firewall-cmd --zone="${ZONE}" --permanent --list-ports
echo
cat <<EOF
Selesai. Port berikut sekarang reachable dari LAN:
EOF
for port in "${PORTS[@]}"; do
  echo "  - http://<host-ip>:${port}"
done

cat <<EOF

Agar port benar-benar hidup saat boot, pastikan ada aplikasi yang listen.
Untuk Brew-POS production sudah dijamin oleh systemd user-service:
  systemctl --user status brewpos.service

Untuk port dev (5173/8080) install service user-level:
  systemctl --user daemon-reload
  systemctl --user enable --now brewpos-dev.service   # lihat scripts/brewpos-dev.service
EOF
