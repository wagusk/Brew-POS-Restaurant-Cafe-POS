# Brew-POS

A Linux-native, modular, multi-terminal Point-of-Sale for restaurants and cafés.

**One command to run. Touch-friendly. Multi-terminal sync. Zero-config.**

```
./run.sh
```

Then open `http://localhost:8000` on any terminal.

---

## Features

- **Multi-terminal sync** — Cashier and Waiter terminals see the same orders in real time via WebSocket.
- **Touch-friendly UI** — Big buttons (48–64px), grid layout, rounded corners, dark MUI theme.
- **Roles** — `admin`, `cashier`, `waiter`, `kitchen` — each with a dedicated screen.
- **PIN login** — Tap a 4-digit PIN, no usernames/passwords needed.
- **Modifiers** — Required/single-select & optional/multi-select groups per product.
- **Tables** — 8 pre-seeded tables; chip-style picker; supports take-away.
- **Payments** — Cash / card / mobile. Cash handles tendered + change.
- **Kitchen Display** — Live ticket board with one-tap state changes (start → ready → served).
- **Receipts** — Modal on checkout with order number; print-friendly.
- **Stats** — Today orders, revenue, average ticket, open tickets.
- **Single-file SQLite** — `backend/brewpos.db`. Portable, no external DB.
- **No Docker required** — Pure Python + Node +11. Runs anywhere.

---

## Quick Start

### 1. Run

```bash
cd Brew-POS
./run.sh
```

The script will:
1. Create a Python virtualenv (`.venv`)
2. Install backend deps (`requirements.txt`)
3. Install frontend deps (`npm install` on first run)
4. Build the frontend (`vite build`)
5. Seed the database (4 users, 6 categories, 26 products, 8 tables) on first run
6. Launch the backend on `http://0.0.0.0:8000`

Open `http://localhost:8000` in a browser. Done.

### 2. Login

Pick any role and enter the PIN:

| Role | PIN | What they see |
|------|-----|---------------|
| Admin | `9999` | Dashboard with live stats |
| Cashier | `1111` | Order-taking screen with menu, cart, modifiers |
| Waiter | `2222` | Floor-plan view, take orders, send to kitchen |
| Kitchen | `3333` | Live ticket board, mark items ready/served |

### 3. Place an order

1. Login as Cashier (`1111`).
2. Browse the menu → tap a product.
3. If it has modifiers (e.g. Espresso → Shot + Milk), pick them.
4. Tap a table chip (T1–T8) or "Takeaway".
5. Tap **Charge $X.XX** — receipt appears.

The order broadcasts to all connected terminals via WebSocket — open the Kitchen page in another tab and watch it appear.

### 4. Serve from the kitchen

1. Login as Kitchen (`3333`).
2. Orders appear in real time.
3. Tap **Start** on an item → **Ready** → **Served**.

### 5. Wipe & re-seed

```bash
rm backend/brewpos.db
./run.sh     # auto re-seeds on first run
```

---

## Project Layout

```
Brew-POS/
├── run.sh                       # ONE command to run (auto-install, build, seed, serve)
├── requirements.txt             # Python deps
├── LICENSE                      # Business Source License 1.1
├── PROGRESS.md                  # Build progress log
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry; serves API + static frontend
│   │   ├── core/
│   │   │   ├── config.py        # Settings (BREWPOS_* env vars)
│   │   │   ├── security.py      # JWT + bcrypt PIN hashing
│   │   │   └── permissions.py   # Permission helpers used by services
│   │   ├── db/
│   │   │   ├── session.py       # SQLAlchemy engine
│   │   │   └── seed.py          # Demo data seeder
│   │   ├── models/__init__.py   # ORM models (User, Product, Order, etc.)
│   │   ├── schemas/__init__.py  # Pydantic DTOs
│   │   ├── services/
│   │   │   ├── crud.py          # Generic create/read/update/delete helpers
│   │   │   ├── tickets.py       # Order ticket lifecycle
│   │   │   ├── printer.py       # Receipt printing dispatch
│   │   │   └── escpos.py        # ESC/POS command builder
│   │   ├── api/
│   │   │   ├── auth.py          # /api/auth/login
│   │   │   ├── menu.py          # /api/menu, /api/tables
│   │   │   ├── orders.py        # /api/orders/* (checkout, list, status)
│   │   │   ├── admin.py         # /api/admin/* (users, reports)
│   │   │   └── settings.py      # /api/settings/*
│   │   └── ws/
│   │       ├── __init__.py      # ConnectionManager
│   │       └── hub.py           # /ws WebSocket route
│   ├── scripts/                 # (placeholder)
│   ├── brewpos.db               # SQLite, auto-created
│   └── brewpos.settings.json    # Persisted runtime settings
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.ts           # Vite + React + manualChunks (vendor splitting)
│   ├── tsconfig.{json,app.json,node.json}
│   ├── public/                  # Static assets copied verbatim to dist/
│   ├── src/
│   │   ├── main.tsx             # React root + Providers
│   │   ├── app/App.tsx          # Router + role-based gating (React.lazy page splitting)
│   │   ├── components/
│   │   │   ├── Shell.tsx        # Top bar (logo, role, sync, logout) + sidebar
│   │   │   └── ModifierModal.tsx
│   │   ├── pages/               # Each is lazy-loaded — see vite.config.ts manualChunks
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── CashierPage.tsx
│   │   │   ├── WaiterPage.tsx
│   │   │   ├── KitchenPage.tsx
│   │   │   ├── BarPage.tsx
│   │   │   ├── AdminPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── store/
│   │   │   ├── index.ts
│   │   │   ├── hooks.ts
│   │   │   ├── authSlice.ts     # JWT + user
│   │   │   ├── cartSlice.ts     # Cart state
│   │   │   └── menuSlice.ts     # Menu + tables cache
│   │   ├── lib/
│   │   │   ├── api.ts           # Axios + endpoints
│   │   │   ├── ws.ts            # WebSocket client with reconnect
│   │   │   └── permissions.ts   # hasPermission(user, perm) helper
│   │   ├── theme/index.ts       # MUI dark theme
│   │   ├── types/index.ts       # Shared TS types
│   │   └── index.css
│   └── dist/                    # Built bundle (gitignored)
├── scripts/
│   ├── dev.sh                   # Dev mode (Vite HMR + backend reload)
│   ├── rebuild-frontend.sh      # Force a fresh `npm run build`
│   ├── install-services.sh      # Install systemd user services
│   ├── brewpos.service          # systemd unit (production)
│   ├── brewpos-dev.service      # systemd unit (dev mode)
│   ├── open-firewall.sh         # Open :8000 / :5173 in firewalld
│   ├── port-8080-server.sh      # Static file server on :8080
│   └── port-8080.service        # systemd unit for :8080 server
└── docs/
    ├── API.md                   # Full API reference
    ├── ARCHITECTURE.md          # System design notes
    └── INSTALL.md               # Deployment guide
```

---

## How Multi-Terminal Sync Works

Brew-POS uses a single FastAPI WebSocket endpoint at `/ws`. Every connected terminal (browser tab) opens a WebSocket on load. When the cashier creates an order:

1. Backend writes to SQLite.
2. Backend broadcasts `{"event":"order_created","data":{...}}` to every connected client.
3. Kitchen + Waiter + Admin pages receive the event, refresh their view.

No polling. No page reload. State propagates in milliseconds.

The frontend maintains a single WebSocket with auto-reconnect (5–10s backoff) on disconnect.

---

## Architecture

### Backend
- **FastAPI** — async REST + WebSocket
- **SQLAlchemy 2.0** — ORM, type-safe relationships
- **SQLite** — single file, no daemon, portable
- **Pydantic 2** — request/response validation
- **python-jose** — JWT signing
- **passlib + bcrypt** — PIN hashing

### Frontend
- **Vite 5** — dev server + bundler
- **React 18 + TypeScript** — UI
- **MUI v6** — component library (dark theme, rounded corners, large buttons)
- **Redux Toolkit** — auth, cart, menu slices
- **React Router 6** — role-based routing
- **Axios** — HTTP with JWT interceptor
- **@mui/icons-material** — flat icons (no Material Symbols font)

### Why these choices?
- **FastAPI** over NestJS/Express — fastest single-process deploy, native WebSocket, type hints end-to-end.
- **SQLite** over Postgres — portable, one file, perfect for a single-machine POS. Upgrade path: change `DATABASE_URL` to Postgres.
- **Vite** over CRA — faster builds, smaller bundle, native ES modules.
- **MUI** over Tailwind — pre-built a11y-compliant components, on-brand theme overrides, icon library.

---

## Configuration

All settings are environment variables (prefix `BREWPOS_`):

| Var | Default | Description |
|-----|---------|-------------|
| `BREWPOS_DATABASE_URL` | `sqlite:///backend/brewpos.db` | SQLAlchemy URL |
| `BREWPOS_JWT_SECRET` | dev value | JWT signing key (CHANGE IN PROD) |
| `BREWPOS_JWT_EXPIRE_MINUTES` | `720` | Token lifetime (12 h) |
| `BREWPOS_HOST` | `0.0.0.0` | Bind host |
| `BREWPOS_PORT` | `8000` | Bind port |

---

## Development

### Hot-reload dev mode

```bash
./scripts/dev.sh
```

- Backend on `http://localhost:8000` (uvicorn --reload)
- Frontend on `http://localhost:5173` (vite dev with HMR + proxy → 8000)

### Force rebuild frontend

```bash
./scripts/rebuild-frontend.sh
```

### Re-seed the database

```bash
cd backend && python -m app.db.seed
```

### Add a new role

1. Add `role` string in `backend/app/models/__init__.py` (User.role is freeform)
2. Add a route in `backend/app/api/` 
3. Add a page in `frontend/src/pages/`
4. Add a route case in `frontend/src/app/App.tsx`

### Add a new product

Edit `backend/app/db/seed.py` and re-run the seed, or POST directly:

```bash
curl -X POST http://localhost:8000/api/menu -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cortado","price":3.25,"category_id":1}'
```

(Currently the menu is read-only via API; the seed is the canonical source. Adding CRUD is straightforward — see TODO below.)

---

## API Reference

See `docs/API.md` for the full reference. Quick examples:

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" -d '{"pin":"1111"}'

# Get menu
curl http://localhost:8000/api/menu

# Checkout
curl -X POST http://localhost:8000/api/orders/checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"dine_in",
    "table_id":3,
    "items":[{"product_id":1,"qty":2,"modifiers":[1,5]}],
    "payment_method":"cash",
    "tendered":20.0
  }'

# Update order status
curl -X PATCH http://localhost:8000/api/orders/1 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status":"served"}'
```

Open `http://localhost:8000/docs` for interactive Swagger UI.

---

## Roadmap

**To be added: printing support, report printing, and etc.**

- [ ] Menu CRUD via admin UI
- [ ] User management via admin UI
- [ ] Receipt printing (ESC/POS, thermal)
- [ ] Inventory deduction on order
- [ ] Multi-outlet (each terminal = outlet)
- [ ] Offline mode (sync queue when WS reconnects)
- [ ] Loyalty / discount codes
- [ ] Reports (daily, weekly, monthly exports)
- [ ] Docker image for headless terminal
- [ ] Card payment integrations (Stripe Terminal)

---

## License

Business Source License 1.1 — see [LICENSE](LICENSE).

This is **source-available, not open source**. You may read the source,
fork it, and use it for non-production purposes (development, testing,
evaluation). Running this in a production environment — i.e. using it to
serve paying customers or operating a hosted service — requires a
separate commercial license from the copyright holder.

On **2036-07-31** (the Change Date), each release of this project
converts to the **Apache License 2.0**, at which point the restrictions
above expire for that version.
