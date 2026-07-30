# Brew-POS — Installation & Portability Guide

Brew-POS is designed to run on a fresh Linux machine with one command. This guide explains what that command does and how to install it on other machines.

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Linux (any modern distro) | Ubuntu 22.04, Debian 12, Fedora 38 |
| Python | 3.10 | 3.11+ |
| Node.js | 18 | 20 LTS |
| RAM | 512 MB | 1 GB |
| Disk | 500 MB | 1 GB |
| Display | 1024×768 | Touch screen 1280×800+ |

### Quick check:
```bash
python3 --version   # should be 3.10+
node --version      # should be 18+
```

If you don't have these, install them:
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm

# Fedora
sudo dnf install -y python3 python3-pip nodejs npm

# Arch
sudo pacman -S python python-pip nodejs npm
```

---

## One-Command Install

```bash
cd Brew-POS
./run.sh
```

That's it. The script handles:
1. **Virtualenv** — creates `.venv/`
2. **Backend deps** — installs from `requirements.txt` into `.venv`
3. **Frontend deps** — `npm install` on first run
4. **Frontend build** — `vite build` writes to `frontend/dist/`
5. **Database seed** — creates a SQLite file with demo data on first run
6. **Server** — launches uvicorn on port 8000 (override with `BREWPOS_PORT=`)

Open `http://localhost:8000` in any browser on the network.

---

## Running on a Touch Terminal

For a dedicated POS terminal:

1. Install a minimal Linux (e.g., Ubuntu Server, no GUI).
2. Install Chromium:
   ```bash
   sudo apt install -y chromium-browser unclutter
   ```
3. Set Chromium to launch in kiosk mode at boot:
   ```bash
   cat > ~/.config/autostart/brewpos-kiosk.desktop <<EOF
   [Desktop Entry]
   Type=Application
   Name=Brew-POS Kiosk
   Exec=chromium --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 http://localhost:8000/login
   X-GNOME-Autostart-enabled=true
   EOF
   ```
4. Add `./run.sh` to crontab or a systemd unit (see SYSTEMD.md if you write one).
5. Calibrate the touchscreen via `xinput_calibrator`.

### Multi-terminal setup

Run the same backend on a server. Each terminal is just a browser pointed at the same URL. The first terminal binds to the keyboard; others use PIN login. They all see the same orders via WebSocket.

**Setup on a server:**
```bash
# On server
cd Brew-POS
BREWPOS_HOST=0.0.0.0 ./run.sh
```

**Setup on each terminal:**
- Point a browser at `http://<server-ip>:8000/login`
- Login with PIN
- Done. The terminal sees live orders.

---

## Moving to a New Machine

```bash
# On old machine
tar czf brewpos-backup.tar.gz Brew-POS/ --exclude='Brew-POS/.venv' --exclude='Brew-POS/frontend/node_modules' --exclude='Brew-POS/frontend/dist' --exclude='Brew-POS/.frontend-hash'

# (Optionally include the DB)
tar czf brewpos-with-data.tar.gz Brew-POS/ --exclude='Brew-POS/.venv' --exclude='Brew-POS/frontend/node_modules' --exclude='Brew-POS/frontend/dist'

# Copy to new machine
scp brewpos-with-data.tar.gz user@newmachine:~

# On new machine
tar xzf brewpos-with-data.tar.gz
cd Brew-POS
./run.sh
```

---

## Production Hardening (TODO)

For a real deployment, address:

- [ ] Change `BREWPOS_JWT_SECRET` to a 32+ char random value
- [ ] Front the backend with nginx (`proxy_pass http://127.0.0.1:8000`)
- [ ] Add HTTPS (Let's Encrypt via certbot)
- [ ] Run uvicorn with `--workers 4` behind a process manager (systemd)
- [ ] Move SQLite to PostgreSQL → set `BREWPOS_DATABASE_URL=postgresql://...`
- [ ] Set up backups (cron `cp brewpos.db backup-$(date +%F).db`)
- [ ] Add rate limiting on `/api/auth/login`
- [ ] Lock down CORS (set `BREWPOS_CORS_ORIGINS` to your domain only)
- [ ] Set up log rotation

---

## Troubleshooting

### "Address already in use"
Something else is on port 8000. Either stop it or use a different port:
```bash
BREWPOS_PORT=9000 ./run.sh
```

### `node` not found
Install Node 18+:
```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts

# Or via package manager
sudo apt install -y nodejs npm
```

### `python3` not found
```bash
sudo apt install -y python3 python3-venv python3-pip
```

### Frontend won't build
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Database issues
```bash
rm backend/brewpos.db
./run.sh    # auto re-seeds on first run
```

### WebSocket not connecting
- Check that port 8000 isn't blocked by a firewall
- Open browser DevTools → Network → WS filter
- You should see `ws://localhost:8000/ws` as `101 Switching Protocols`

### Login keeps failing
- The seed runs once. If you've changed the DB, re-seed:
  ```bash
  cd backend && python -m app.db.seed
  ```
- Default PINs: admin 9999, cashier 1111, waiter 2222, kitchen 3333
