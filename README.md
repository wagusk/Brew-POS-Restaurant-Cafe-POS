# Brew-POS

A Linux-native, modular, multi-terminal Point-of-Sale for restaurants and cafés.

**One command to run. Touch-friendly. Multi-terminal sync. Zero-config.**

```
./run.sh
```

Then open `http://localhost:8000` on any terminal.

---

## Features

- **Multi-terminal sync** — Cashier, Waiter, Kitchen, and Bar terminals see the same orders in real time via WebSocket.
- **Touch-friendly UI** — Big buttons (48–72px), grid layout, 12px rounded corners, light MUI theme.
- **Roles** — `admin`, `master`, `cashier`, `waiter`, `kitchen`, `bar` — each with a dedicated screen.
- **PIN login** — Tap a 4–8 digit PIN, no usernames/passwords needed.
- **Modifiers** — Required/single-select & optional/multi-select groups per product.
- **Tables** — Pre-seeded tables (T1–T8); floor-plan view; blue = has open bill, default = empty.
- **Payments** — Cash / card / mobile. Cash handles tendered + change with change-due popup.
- **Open Bill (Cashier)** — Click any empty table → "Open New Bill?" popup → Yes creates an empty bill, tile turns blue. Waiter can then add items.
- **Kitchen Display** — Live ticket board with one-tap state changes (start → ready → served).
- **Bar Display** — Dedicated drink station with independent item tracking.
- **Station-isolated serving** — Kitchen marking served doesn't affect bar display, and vice versa.
- **Station routing** — Products route to kitchen, bar, or both. Combos appear on both stations.
- **Single-bill-per-table** — Only one open bill per table. Waiter adds to existing, never duplicates.
- **Permission-based access** — Granular permissions (order.open, order.close, kitchen.serve, etc.).
- **Dynamic roles** — Admin can create/edit roles with custom permissions.
- **Receipts** — Reprint button on paid bills; ESC/POS printer support.
- **Stats** — Today orders, revenue, average ticket, open tickets.
- **Reports** — Sales summary, category breakdown, item sales, payment methods, bill history.
- **Discounts** — Fixed or percent presets configured by admin; cashier applies at checkout.
- **Single-file SQLite** — `backend/brewpos.db`. Portable, no external DB.
- **No Docker required** — Pure Python + Node. Runs anywhere.
- **Admin Panel** — Full CRUD for users, products, categories, tables, roles, tax, discounts, printer config.
- **Database management** — URL editor, reload engine, reset & seed, export/import backup.

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
5. Seed the database (4 users, 7 categories, 28 products, 8 tables) on first run
6. Launch the backend on `http://0.0.0.0:8000`

Open `http://localhost:8000` in a browser. Done.

### 2. Login

Pick any role and enter the PIN:

| Role | PIN | What they see |
|------|-----|---------------|
| Admin | `9999` | Dashboard with live stats, reports, user/product/table/role management |
| Cashier | `1111` | Floor plan + bill view. Open bills, pay, reprint receipts |
| Waiter | `2222` | Floor-plan view, take orders, add to existing bills, send to kitchen |
| Kitchen | `3333` | Live ticket board, mark items ready/served |
| Bar | `3333` | Live drink ticket board, independent from kitchen |

### 3. Cashier opens a new bill

1. Login as Cashier (`1111`).
2. Click any **empty** table (gray) on the left floor plan.
3. Popup: "Open New Bill?" → tap **Yes**.
4. Table turns blue — bill is open with zero items.
5. Waiter can now add items to this bill.

### 4. Place an order (Waiter)

1. Login as Waiter (`2222`).
2. Click an empty table → menu input popup.
3. Pick products, modifiers, quantity.
4. Tap **Send to Kitchen** — order broadcasts to kitchen/bar displays.

Or click a blue table (open bill) → confirm → add more items to the existing bill.

### 5. Serve from the kitchen / bar

1. Login as Kitchen (`3333`) or Bar (`3333` — same PIN, different screen).
2. Orders appear in real time.
3. Tap **Start** on an item → **Ready** → **Served**.
4. Or tap **Mark All Served** to complete all items for that station.

Kitchen and Bar operate independently — marking served on one station doesn't affect the other.

### 6. Close a bill (Cashier)

1. Login as Cashier (`1111`).
2. Click a blue table → bill appears on the right.
3. Tap **Pay Bill $X.XX** → choose method + tendered → Confirm.
4. For cash: if tendered > total, change-due popup shows the amount.

### 7. Wipe & re-seed

```bash
rm backend/brewpos.db
./run.sh     # auto re-seeds on first run
```

---

## Order Flow

```
Waiter                    Kitchen / Bar              Cashier
  │                           │                         │
  ├─ Open Bill (or new) ──────┤                         │
  ├─ Add items ──────────────►│                         │
  ├─ Send to Kitchen ────────►│                         │
  │                           ├─ Start → Ready → Served │
  │                           │                         │
  │                           ├─ (all items served) ──►├─ Auto-bump to "served"
  │                           │                         ├─ Pay Bill → paid
  │                           │                         └─ Receipt
```

**Cashier can also open a bill first** (empty), then the waiter adds items to it.

---

## Project Layout

```
Brew-POS/
├── run.sh                       # ONE command to run (auto-install, build, seed, serve)
├── requirements.txt             # Python deps
├── LICENSE                      # Business Source License 1.1
├── PROGRESS.md                  # Build progress log
├── README.md                    # This file
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
│   │   ├── models/__init__.py   # ORM models (User, Product, Order, Role, etc.)
│   │   ├── schemas/__init__.py  # Pydantic DTOs
│   │   ├── services/
│   │   │   ├── __init__.py      # Order lifecycle, status updates, stats, open_bill
│   │   │   ├── crud.py          # Generic create/read/update/delete helpers
│   │   │   ├── tickets.py       # Ticket building for printing
│   │   │   ├── printer.py       # Receipt printing dispatch
│   │   │   └── escpos.py        # ESC/POS command builder
│   │   ├── api/
│   │   │   ├── auth.py          # /api/auth/login
│   │   │   ├── menu.py          # /api/menu, /api/tables
│   │   │   ├── orders.py        # /api/orders/* (checkout, open-bill, list, status)
│   │   │   ├── admin.py         # /api/admin/* (users, reports, settings, roles)
│   │   │   └── settings.py      # /api/admin/settings/*
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
│   │   ├── theme/index.ts       # MUI light theme
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
3. Kitchen + Bar + Waiter + Admin pages receive the event, refresh their view.

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
- **MUI v6** — component library (light theme, 12px rounded corners, large buttons)
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

Use the Admin panel (Products workspace) or POST directly:

```bash
curl -X POST http://localhost:8000/api/admin/products \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"name":"Cortado","price":3.25,"category_id":1}'
```

---

## API Reference

See `docs/API.md` for the full reference. Quick examples:

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" -d '{"pin":"1111"}'

# Get menu
curl http://localhost:8000/api/menu

# Open a new bill on a table (cashier)
curl -X POST http://localhost:8000/api/orders/open-bill \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"table_id":3,"type":"dine_in"}'

# Checkout (waiter sends order with items)
curl -X POST http://localhost:8000/api/orders/checkout \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"dine_in",
    "table_id":3,
    "items":[{"product_id":1,"qty":2,"modifiers":[1,5]}],
    "payment_method":"cash",
    "tendered":20.0
  }'

# Update item status (station-isolated)
curl -X PATCH http://localhost:8000/api/orders/1 \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"item_id":1,"item_status":"served"}'
```

Open `http://localhost:8000/docs` for interactive Swagger UI.

---

## Status flow

`Order.status`:
```
open → accepted → preparing → ready → served → paid
   ↓                              ↓
  cancelled                     void
```

`OrderItem.status`:
```
new → preparing → ready → served
   ↓
  cancelled
```

The cashier can **open a bill first** (empty, status=`open`), then the waiter adds items. Once all items are served, the order auto-bumps to `served`, then the cashier closes it → `paid`.

---

## Roadmap

- [x] Menu CRUD via admin UI
- [x] User management via admin UI
- [x] Kitchen + Bar station displays
- [x] Station-isolated serving
- [x] Station routing (kitchen/bar/both)
- [x] Reports (sales, categories, items, payments, bill history)
- [x] Database management (URL editor, reload, reset, export, import)
- [x] Discount presets (fixed + percent)
- [x] Printer configuration (network/USB/dummy)
- [x] Permission-based access control
- [x] Dynamic role management
- [x] Single-bill-per-table enforcement
- [x] Cashier "Open Bill" popup
- [ ] Receipt printing (ESC/POS, thermal) — config UI done, hardware pending
- [ ] Inventory deduction on order
- [ ] Multi-outlet (each terminal = outlet)
- [ ] Offline mode (sync queue when WS reconnects)
- [ ] Loyalty / discount codes
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
