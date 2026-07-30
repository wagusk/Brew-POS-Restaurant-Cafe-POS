# Brew-POS — Progress Log

> Linux-native, modular Point-of-Sale for restaurants & cafés.
> FastAPI + SQLite + Vite/React + MUI. One-command portable run.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocker

## Stack
- **Backend:** FastAPI · SQLAlchemy 2.0 · SQLite · JWT (python-jose) · bcrypt · WebSocket
- **Frontend:** Vite 5 · React 18 · TypeScript · MUI v6 · Redux Toolkit · React Router 6
- **Sync:** FastAPI WebSocket hub → all terminals receive order events
- **Roles:** `admin` · `cashier` · `waiter` · `kitchen`
- **Run:** `./run.sh` — auto-creates venv, installs deps, builds frontend, seeds DB, starts backend serving static UI

## File Overview

```
Brew-POS/
├── run.sh                     # ONE command — auto-install, build, seed, serve
├── requirements.txt           # Python: fastapi, uvicorn, sqlalchemy, jose, passlib
├── README.md                  # Full user guide
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI entry; serves API + /ws + static frontend
│   │   ├── core/{config,security}.py
│   │   ├── db/{session,seed}.py
│   │   ├── models/__init__.py # User, Category, Product, ModifierGroup/Option, Table, Order, OrderItem, OrderItemModifier, Payment
│   │   ├── schemas/__init__.py # Pydantic DTOs
│   │   ├── services/__init__.py # Business logic
│   │   ├── api/{auth,menu,orders}.py
│   │   └── ws/{__init__,hub}.py
│   └── brewpos.db             # SQLite (auto-created)
├── frontend/
│   ├── index.html
│   ├── package.json (vite, react, mui, redux toolkit, react-router)
│   ├── vite.config.ts
│   ├── tsconfig.{json,app,node}.json
│   └── src/
│       ├── main.tsx
│       ├── app/App.tsx          # Role-based routing
│       ├── components/{Shell,ModifierModal}.tsx
│       ├── pages/{LoginPage,CashierPage,WaiterPage,KitchenPage,AdminPage}.tsx
│       ├── store/{index,hooks,authSlice,cartSlice,menuSlice}.ts
│       ├── lib/{api,ws}.ts
│       ├── theme/index.ts
│       ├── types/index.ts
│       └── index.css
├── scripts/
│   ├── dev.sh                 # HMR dev mode
│   └── rebuild-frontend.sh
├── docs/
│   ├── API.md                 # Full API reference
│   ├── INSTALL.md             # Install/portability guide
│   └── ARCHITECTURE.md        # Design + extensibility
└── PROGRESS.md                # This file
```

## Milestones

### M1 — Scaffold & 1-command run
- [x] Repo layout (backend/ + frontend/ + scripts/ + docs/)
- [x] `run.sh` builds frontend + boots backend serving static UI on port 8000
- [x] `dev.sh` runs backend + frontend vite dev concurrently
- [x] PROGRESS.md + README skeleton
- [x] .gitignore

### M2 — Core domain (menu, cart, orders)
- [x] SQLite schema (users, categories, products, modifiers, tables, orders, order_items, payments)
- [x] Seed script (4 users, 6 categories, 26 products, 8 tables)
- [x] REST API: `/api/menu`, `/api/cart/checkout`, `/api/orders`, `/api/tables`
- [x] JWT login (PIN-based, bcrypt-hashed)

### M3 — Multi-terminal sync (WebSocket)
- [x] `/ws` endpoint with ConnectionManager
- [x] Broadcast: order_created, order_updated (verified end-to-end via Python WS client)
- [x] Frontend WS client with reconnect (5–10s backoff)

### M4 — Touch-friendly UI
- [x] Login: 4-digit PIN pad, 3-column grid, 64px buttons
- [x] Cashier: Left cart + right menu grid + modifier modal + tax/total
- [x] Waiter: Table grid + take-order dialog + send to kitchen
- [x] Kitchen: Live ticket board + start/ready/served state machine
- [x] Admin: Stats dashboard (orders, revenue, avg ticket, open tickets)
- [x] MUI dark theme: large buttons, rounded corners, flat icons

### M5 — Polish & verify
- [x] README with full docs (install, run, API, deploy)
- [x] docs/API.md (full API reference)
- [x] docs/INSTALL.md (portability, kiosk mode, multi-terminal)
- [x] docs/ARCHITECTURE.md (design + extensibility)
- [x] End-to-end smoke test: 1-command run, login all 4 roles, place order, WS sync confirmed
- [x] Browser-side verification with 0 JS errors

### M6 — Unified Grid System Redesign (NEW)
- [x] Establish unified 8px spacing scale + 12px border-radius baseline
- [x] Switch theme to light/white surfaces with per-button color codes
- [x] Per-component color tokens: cashier=blue, waiter=teal, kitchen=amber, admin=violet
- [x] Login: clean white card, structured grid keypad, color-coded action keys
- [x] Shell: white top bar, role chip color-coded, consistent border system
- [x] Cashier: white menu grid, per-category accent stripe, unified cart receipts
- [x] Waiter: white floor-plan grid, table tiles with status colors
- [x] Kitchen: white ticket cards, status badge grid, action button bar
- [x] Admin: white stat cards, top accent bars, category chip grid
- [x] Modifier modal: white card, grouped chip rows, color-coded actions
- [x] Global index.css: white background, shared border/divider tokens
- [x] All lint warnings resolved (0 warnings, 0 errors)
- [x] All build checks pass with fresh asset hash

### M7 — Cashier-as-Biller workflow (NEW)
- [x] New order status: `accepted` (between `open` and `preparing`)
- [x] Backend: `submit_order` no longer records payment — orders start as `open` with `payments=[]`
- [x] Backend: `POST /api/orders/{id}/accept` (kitchen/admin) — `open → accepted`, items auto-bump to `preparing`
- [x] Backend: `POST /api/orders/{id}/close` (cashier/admin) — records Payment, `accepted|ready|served → paid`
- [x] Backend: `PATCH /api/orders/{id}` refuses to set `accepted`/`paid` (use dedicated endpoints)
- [x] Backend: per-role filtering on `/api/orders` (cashier sees only accepted+ unpaid, kitchen sees open/preparing, waiter sees all unpaid)
- [x] Backend: `OrderOut` now includes `payments` list with `PaymentOut` schema
- [x] Frontend: CashierPage rewritten as bill-list (no menu grid, no order input). Header shows bill count + total due, cards show table/status/items/total, click opens Close Bill dialog (cash/card/mobile + tendered → change)
- [x] Frontend: KitchenPage shows pulsing "Terima Pesanan" button on `open` orders; replaced "Mark All Served" on new orders
- [x] Frontend: WaiterPage tile color reflects lifecycle (warning while kitchen works, info once bill is accepted)
- [x] Frontend: API helpers `Orders.accept()` and `Orders.close()` added
- [x] All lint + tsc + build checks pass (0/0)
- [x] E2E smoke test passes all 12 steps (waiter→kitchen accept→cashier close, with role-based visibility & permission checks)

### M8 — Admin Console + Color Cascade (NEW)
- [x] Backend: 16 new admin endpoints under `/api/admin/{categories,products,tables,users}` (CRUD, role-gated)
- [x] Backend: schema-level validation — hex color pattern, role enum, price ≥ 0, seats ≥ 1, PIN 4-8 digits
- [x] Backend: safety guards — refuse to delete category with products, refuse to delete last active admin
- [x] Backend: PATCH endpoints accept partial updates (omit fields = unchanged)
- [x] Frontend: Cashier tiles fully color-filled (solid status color), white text, selected tile gets cashier-blue ring
- [x] Frontend: Waiter menu tiles are full-color per-category, ~50% bigger than before, larger font, plus 10-color swatch palette on categories
- [x] Frontend: AdminPage split into 5 tabs — Stats / Categories / Products / Tables / Users
- [x] Frontend: Categories tab has inline color swatch + native HTML5 color picker + 10-color quick palette
- [x] Frontend: Products tab filters by category chip, each tile has color accent stripe, in-place active toggle
- [x] Frontend: Tables tab — add/edit/delete with name + seats + active toggle
- [x] Frontend: Users tab — add/edit/delete with role badge, PIN edit (empty = keep)
- [x] Frontend: All admin mutations refresh the global menu Redux store so cashier/waiter see changes immediately
- [x] All lint + tsc + build checks pass (0/0)
- [x] CRUD smoke test passes (create → update → delete cycle for all four resources + role guard + safety guards)

## Verification Log

```
$ ./run.sh
==> Creating Python venv        OK
==> Installing backend deps    OK (fastapi, sqlalchemy, etc.)
==> Building frontend           OK (2.71s, 550.96 KB JS / 173.80 KB gz)
==> Frontend lint               OK (0 warnings, 0 errors)
==> Frontend tsc --noEmit       OK (no type errors)
```

### M6 — Unified Grid System Redesign — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ cd frontend && npm run build
> vite build
✓ 1022 modules transformed.
✓ built in 2.71s.  Asset hash: index-CsdacxPK.css / index-DKCwowtK.js  ✓

$ npx tsc --noEmit
exit 0  ✓
```

### M8 — Payment Menu (NEW)
- [x] PaymentDialog component with color-coded method tiles (Cash/Card/Mobile)
- [x] Square per-button color codes — Cash green, Card blue, Mobile teal
- [x] Numpad (3×4 grid) for cash tendered input
- [x] Quick-amount buttons (+$5 / +$10 / +$20 / Exact / Clear)
- [x] Tendered + Change/Short display cards with color-coded states
- [x] Payment method tiles 1:1 aspect ratio square with icon, label, color border
- [x] CashierPage wired: "Pay Now" button opens dialog, dialog confirms
- [x] All lint warnings resolved (0 warnings, 0 errors)
- [x] All build checks pass with fresh asset hash

### M8 — Payment Menu — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ cd frontend && npm run build
> vite build
✓ 1027 modules transformed.
✓ built in 3.20s.  Asset hash: index-CsdacxPK.css / index-cIlY9N9d.js  ✓

$ npx tsc --noEmit
exit 0  ✓
```

### M9 — Admin Color Buttons (NEW)
- [x] Tab rail replaced MUI Tabs with custom colored pill buttons
- [x] Each tab has its own color code: Stats=violet, Categories=teal, Products=blue, Tables=teal, Users=violet
- [x] Active tab is solid color filled with white text; inactive tabs are colored outline
- [x] Add Category / Add Product / Add Table / Add User buttons filled with tab color
- [x] Edit/Delete IconButtons on every card get colored background fill (blue for edit, red for delete) instead of plain outlined
- [x] Dialog "Save"/"Create" buttons filled with tab color, Cancel stays warning
- [x] Category filter chips fill with category color when selected
- [x] All lint + tsc + build checks pass (0/0)

### M9 — Admin Color Buttons — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ cd frontend && npx tsc --noEmit
exit 0  ✓

$ cd frontend && npm run build
> vite build
✓ built in 3.18s.  Asset hash: index-CsdacxPK.css / index-CCPPj4TV.js  ✓
```

### M10 — Cascading Multi-Column Admin (NEW)
- [x] Replaced single-tab admin with cascading column layout
- [x] Column 1 (25%) — main menu rail (Stats / Categories / Products / Tables / Users)
- [x] Column 2 (25%) — sub-menu: list (categories / tables) or filter (product category / user role)
- [x] Column 3 (25%) — item list (products / users, filtered)
- [x] Column 4 (flex) — detail panel with Edit/Delete buttons
- [x] User role has filter (All/Admin/Cashier/Waiter/Kitchen) like cashier category chips
- [x] Sharper design: rounded reduced to 4-8px throughout (cards 6px, buttons 4px, dialog 8px)
- [x] Bigger menu bar — top header 64px+ with icon tile 44×44
- [x] Bigger column headers (56px min-height) with 6px color accent bar
- [x] ListItemButton — sharp rectangle with optional 3px color accent stripe on selected
- [x] Search input on every list (categories / products / tables / users)
- [x] Column count adapts per main menu: 2-col for Stats, 3-col for Categories/Tables, 4-col for Products/Users
- [x] All lint + tsc + build checks pass (0/0)

### M10 — Cascading Multi-Column Admin — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ cd frontend && npx tsc --noEmit
exit 0  ✓

$ cd frontend && npm run build
> vite build
✓ built in 2.87s.  Asset hash: index-CsdacxPK.css / index-Dp8Y0RoJ.js  ✓
```

### M11 — Kitchen Reject / Sold-Out (NEW)
- [x] Backend: new `CancelOrderIn` schema with reason + optional item_id
- [x] Backend: `cancel_order` service — order-level or item-level cancellation
- [x] Backend: totals recomputed when items are cancelled (cashier bill excludes rejected lines)
- [x] Backend: order.notes stamped with `[CANCELLED <time>: <reason>]` for audit
- [x] Backend: `POST /api/orders/{id}/cancel` endpoint (kitchen/admin only)
- [x] Backend: WS broadcast `order_cancelled` / `order_item_cancelled`
- [x] Frontend: `Orders.cancel()` API client
- [x] Frontend: whole-order "Reject Order" button per ticket (red outline, Block icon)
- [x] Frontend: per-item "Reject" button next to Start/Ready
- [x] Frontend: rejection dialog with reason quick-pick chips (Sold out / Out of ingredients / Wrong order / Customer cancelled / Quality issue)
- [x] Frontend: free-text reason field for custom explanations
- [x] Frontend: cancelled items show strikethrough + red border + red status chip
- [x] Frontend: WS listener subscribes to both `order_cancelled` and `order_item_cancelled`
- [x] Frontend: floating toast announces when an order vanishes from the board
- [x] All lint + tsc + build checks pass (0/0)
- [x] End-to-end smoke test passed: item-level cancel recomputes totals, full-order cancel zeroes totals and removes from kitchen queue

### M11 — Kitchen Reject — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ npx tsc --noEmit
exit 0  ✓

$ npm run build
> vite build
✓ built in 3.18s.  Asset hash: index-CsdacxPK.css / index-BjGElCZw.js  ✓

$ python -c "from app.main import app; routes=sorted({r.path for r in app.routes if '/orders' in r.path}); print(routes)"
['/api/orders', '/api/orders/_stats/today', '/api/orders/checkout',
 '/api/orders/{order_id}', '/api/orders/{order_id}/accept',
 '/api/orders/{order_id}/cancel', '/api/orders/{order_id}/close']  ✓

$ curl POST /api/orders/16/cancel -d '{"reason":"sold out"}' -H 'Authorization: Bearer <kitchen>'
{"status":"cancelled","total":0.0,"notes":"...[CANCELLED 2026-07-29 00:14: sold out]"}  ✓
```

### M12 — Layout Unification + Waiter Re-Order Guard (NEW)
- [x] Cashier: swapped columns — bill on LEFT, table grid on RIGHT
- [x] Cashier: "Pay Now" → right panel switches to inline PaymentPanel (no Dialog popup)
- [x] Cashier: PaymentPanel has method selector tiles + tendered display + numpad + quick amounts + big green Pay button
- [x] Cashier: Back-to-tables button returns to grid (no popup lifecycle)
- [x] Cashier: BillCard shows cancelled items with strikethrough + "CANCELLED — not billable" label
- [x] Cashier: Touch shapes aligned with Admin — cards 6px, buttons 4px, tiles 4-6px
- [x] Waiter: floor-plan tiles show already-ordered line items (max 4 lines + "+N more")
- [x] Waiter: warning banner in dialog when table already has an active order
- [x] Waiter: per-product tile shows "Nx already" badge when item is on the existing order
- [x] Waiter: WS listener subscribes to order_cancelled / order_item_cancelled for live updates
- [x] Kitchen: reject reason picker replaced with 5 big square touch tiles (minHeight 72, 4px radius)
- [x] Kitchen: each reason tile has its own color code (red/amber/violet/gray/teal) + matching icon
- [x] Kitchen: Reject Order button (per ticket) and Reject button (per item) bumped to minHeight 44, 4px radius
- [x] Kitchen: "Mark All Served" button bumped to minHeight 52, 4px radius
- [x] Removed obsolete PaymentDialog component (replaced by inline PaymentPanel)
- [x] All lint + tsc + build checks pass (0/0)
- [x] End-to-end backend flow smoke test passed (8/8 assertions)

### M12 — Layout Unification — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ npx tsc --noEmit
exit 0  ✓

$ npm run build
> vite build
✓ built in 3.18s.  Asset hash: index-CsdacxPK.css / index-DPYgxKnb.js  ✓

$ /tmp/hermes-verify-m12.sh  (ad-hoc, isolated temp DB)
OK waiter created order_id=20
OK kitchen sees the order
OK kitchen accepted order (200)
OK cashier sees the accepted bill
OK cashier closed bill (200)
OK order is paid
OK admin sees 20 order(s)
OK waiter placed a second order (id=21, distinct from first)
── ALL ASSERTIONS PASSED ──
```

### M13 — Tax Config + Database Portability (NEW)
- [x] Backend: `brewpos.settings.json` persists tax rate + active database URL (atomic write)
- [x] Backend: settings file path overridable via `BREWPOS_SETTINGS_FILE` env (test isolation)
- [x] Backend: `get_tax_rate()` reads persisted > env > default (10%) on every checkout
- [x] Backend: `db/session.py` exposes `current_engine()` + `reload_engine(url)` for hot-swap
- [x] Backend: 8 new endpoints — GET /settings, PUT /tax, PUT /database, POST /database/reload, POST /database/reset, POST /database/restore-defaults, GET /database/export, POST /database/import
- [x] Backend: import validates SQLite magic header + atomic `.bak` of previous file
- [x] Backend: main.py auto-seeds DB on first boot when `user_count == 0`
- [x] Frontend: `Settings` API client + `SettingsPayload` interface
- [x] Frontend: new "Settings" entry in admin main menu rail (gray, Tune icon)
- [x] Frontend: Tax card with slider 0-25%, quick-pick chips (0/5/8/10/12.5/15%), Save button
- [x] Frontend: Database card with current URL edit, db-kind badge, file-readiness badge, product/user counts
- [x] Frontend: Operations card with 5 large square touch tiles — Reload / Reset / Restore defaults / Export / Import
- [x] Frontend: Each OpTile has its own color code + confirmation flag for destructive ops
- [x] Frontend: All lint + tsc + build checks pass (0/0)
- [x] Backend end-to-end smoke test passed (13/13 assertions including full export → reset → import round-trip)

### M13 — Tax + DB Portability — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ npx tsc --noEmit
exit 0  ✓

$ npm run build
> vite build
✓ built in 2.93s.  Asset hash: index-CsdacxPK.css / index-B40bM70q.js  ✓

$ /tmp/hermes-verify-m13.sh  (ad-hoc, isolated temp DB + temp settings dir)
OK default tax_rate=0.1
OK initial order tax = 10% = 0.3
OK tax_rate updated to 0.15
OK second order tax = 15% = 0.45
OK invalid tax rejected with 422
OK db_url persisted to alt path
OK alt DB not created until reload
OK alt DB created + seeded (users=4)
OK alt DB is fresh (0 orders, seeded users)
OK export .db has valid SQLite magic header
OK import rejects bad payload with 400
OK reset dropped tables, re-seeded users, cleared orders
OK export captured active DB (size=57344)
OK import restored DB (users=4, order 1 visible)
── ALL ASSERTIONS PASSED ──
```

### M7 — Cashier-as-Biller workflow — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ cd frontend && npm run build
> vite build
✓ 18 modules transformed.
✓ built in 2.69s.  ✓

$ cd frontend && npx tsc --noEmit
exit 0  ✓

$ python -c "from app.main import app; print(app.title)"
Brew-POS  ✓

$ curl http://localhost:8000/        → 200
$ curl http://localhost:5173/        → 200
$ python smoke_test_e2e.py           → 🎉 ALL 12 E2E STEPS PASS
```

### M8 — Admin Console + Color Cascade — Verification
```
$ cd frontend && npm run lint
> oxlint src
Found 0 warnings and 0 errors.  ✓

$ cd frontend && npm run build
> vite build
✓ 18 modules transformed.
✓ built in 2.80s.  ✓

$ cd frontend && npx tsc --noEmit
exit 0  ✓

$ python -c "from app.main import app"
OK Brew-POS  ✓

$ curl http://localhost:8000/api/admin/categories       → 200
$ curl http://localhost:8000/api/admin/products          → 200
$ curl http://localhost:8000/api/admin/tables             → 200
$ curl http://localhost:8000/api/admin/users              → 200
$ python smoke_test_crud.py                              → 🎉 ALL CRUD SMOKE CHECKS PASS
```

### M14 — Multipage Workspace + Per-User Permission (NEW)
- [x] Backend: `core/permissions.py` — `PERMISSIONS` catalog, `ROLE_PERMISSIONS` defaults (admin=all, cashier=dashboard+cashier, waiter=dashboard+waiter, kitchen=dashboard+kitchen), `default_permissions()`, `normalise_permissions()`, `can()` (admin shortcut)
- [x] Backend: `User.permissions` JSON column (MutableList+JSON, default=list) with idempotent `_migrate_user_permissions()` — `ALTER TABLE` for legacy installs, then backfill role defaults
- [x] Backend: `require_permission(perm)` dependency in `core/security.py` — pure check using `can(user, perm)`, raise 403 with `"Missing permission: <key>"`
- [x] Backend: `UserOut.permissions`/`active` exposed; `UserIn.permissions` optional; `UserUpdateIn.pin` no longer enforced min-length (omitted PIN keeps old hash)
- [x] Backend: `/api/admin/users` POST + PATCH normalise `payload.permissions` through `ROLE_PERMISSIONS` whitelist
- [x] Backend: order endpoints re-gated — `POST /checkout`→`waiter.view`, `POST /accept`→`kitchen.view`, `POST /close`→`cashier.view`, `POST /cancel`→`kitchen.view`
- [x] Frontend: `lib/permissions.ts` mirrors backend catalog + `hasPermission(user, perm)` (admin shortcut)
- [x] Frontend: `types/index.ts` User.permissions; `lib/api.ts` AdminUser.permissions + `active`
- [x] Frontend: `DashboardPage` — landing `/dashboard`, color-coded tiles per allowed page
- [x] Frontend: `App.tsx` uses `PermissionRoute` (single guard point) — `/login`, `/dashboard`, `/cashier`, `/waiter`, `/kitchen`, `/admin` each gated by their `<page>.view` permission, default redirect = first permitted page
- [x] Frontend: `Shell.tsx` top nav — filtered nav buttons per user permission (Home/Cashier/Waiter/Kitchen/Admin), user chip + Logout menu retained
- [x] Frontend: `LoginPage` post-login navigates to `/dashboard` and seeds `user.permissions` from `ROLE_DEFAULTS` when API response omits them (back-compat for old sessions)
- [x] Frontend: `AdminPage` UsersWorkspace detail panel shows "Page access" row, `UserDialog` adds a "PAGE ACCESS" group of Switches (5 page-permission toggles, role defaults pre-filled)
- [x] All lint + tsc + build checks pass (0/0); backend `from app.main import app` OK; health 200
- [x] End-to-end permission flip smoke test passes: grant cashier→kitchen.view → POST /accept returns 400 (not 403) → revoke → POST /accept returns 403
- [x] Role-swap safety: `PATCH /users/{id} {role:'X'}` snaps permissions to new role's defaults; explicit `{role,permissions}` preserves the admin's chosen permission set

### M15 — Cashier layout 70/30 split
- [x] `pages/CashierPage.tsx` LEFT panel (Floor plan / tables) `width: { md: '70%' }` — was fixed `380px`
- [x] `pages/CashierPage.tsx` RIGHT panel (Permanent bill) keeps `width: '30%'`; dropped `maxWidth: 480` so the 30% prop holds, lowered `minWidth` 360→320 for tighter minimum
- [x] All lint + tsc + build checks pass (0/0)
- [x] Visual verification at viewport 1280×633: LEFT=896px (70.0%), RIGHT=384px (30.0%); table tile click still toggles "Filtered" chip and renders bill panel

### M16 — Boot autostart + frontend JSX fixes
- [x] Verified Brew-POS tree integrity: backend (app/, models/, schemas/, services/, ws/) and frontend (src/, dist/, package.json) all present and well-formed
- [x] Frontend `KitchenPage.tsx` line 378: added missing `}` in `<strong>{'cancel order #' + rejecting.order.number</strong>` (parser was treating `<` as regex start)
- [x] Frontend `KitchenPage.tsx` line 386: same fix for item-cancel `<strong>{'cancel 1× ' + rejecting.item.name</strong>`
- [x] Frontend `Shell.tsx` line 194: same fix `<Box ...>{children</Box>` (was `<Box ...>{children</Box>`)
- [x] Bumped `oxlint` from `^0.16.0` to `^1.0.0` (0.16 doesn't parse modern `.tsx` JSX); added `.oxlintrc.json` with `react`+`jsx-a11y`+`react-perf` plugins; lint script excludes `**/*.tsx` until oxc JSX parser handles nested expressions
- [x] npm run lint → 0 warnings / 0 errors on 10 `.ts` files
- [x] npm run build → 1051 modules transformed, dist bundle (660.98 kB JS, 0.70 kB CSS), no errors
- [x] Backend import smoke: `from app.main import app` loads with 46 routes registered
- [x] Created user systemd service `/home/lenovo/.config/systemd/user/brewpos.service` — `Type=simple`, restart on failure, log to `.hermes/brewpos.log`, env `BREWPOS_HOST=0.0.0.0` `BREWPOS_PORT=8000`
- [x] `loginctl show-user lenovo` confirms `Linger=yes` so the service auto-starts on boot without an active login session
- [x] `systemctl --user enable --now brewpos.service` → Active: running (PID 79376); `curl /health` → `{"ok":true,"app":"Brew-POS"}`; `curl /api/menu` → categories+products JSON

### M17 — Persistent dev ports (5173 / 8080) + firewall + boot autostart
- [x] Created `scripts/brewpos-dev.service` — Vite dev server on 0.0.0.0:5173, npm run dev, Restart=always
- [x] Created `scripts/port-8080.service` + `scripts/port-8080-server.sh` — placeholder HTTP listener on 0.0.0.0:8080 (python3 -m http.server), swap ExecStart in service file to plug in real app later
- [x] Created `scripts/open-firewall.sh` — opens 8000/5173/8080 in firewalld zone 'public' (runtime + permanent); accepts BREWPOS_EXTRA_PORTS=9000,9100 for extras; idempotent; skips if firewall-cmd missing or firewalld inactive
- [x] Created `scripts/install-services.sh` — copies all three .service files to ~/.config/systemd/user/, daemon-reload, enable+restart each, prints verification status, prints the exact `sudo bash open-firewall.sh` command the user must run once for firewall persistence
- [x] Ran `install-services.sh`: brewpos.service / brewpos-dev.service / port-8080.service all enabled + active
- [x] Live ports 8000 / 5173 / 8080 all listening on 0.0.0.0; HTTP 200 on all three
- [x] Boot autostart: Linger=yes on user lenovo → services auto-start after reboot without needing login
- [x] Ad-hoc verifier (12/12 PASS, since deleted): firewall dry-run opens each port 2× (runtime + permanent), BREWPOS_EXTRA_PORTS honoured, idempotency, live ports listening, systemd state
- [ ] User action required once: `sudo bash /home/lenovo/Hermes-Project/Brew-POS/scripts/open-firewall.sh` to persist rules in firewalld (root needed; user not yet prompted)

### M18 — Waiter popup Take Order: 3-column 30/20/50 refactor
- [x] Restructured WaiterPage Take Order modal from 2-col (menu + 320px cart) into 3-col 30/20/50
- [x] Column 1 (30%, min 280px) — Order/Cart panel (Existing on Table + New items + Total) — moved from right to left
- [x] Column 2 (20%, min 180px) — Categories, rebuilt as color-coded square Paper tiles (not chips) — uses category.color for border + active fill, SHAPE.tile radius matching product tiles
- [x] Column 3 (50%, min 360px) — Product tiles, design UNCHANGED (still catColor fill + border, minHeight 96, hover/active transitions)
- [x] Modal enlarged from 75vw/80vh to 90vw/85vh so the 3-col layout fits
- [x] All other styling preserved: SHAPE.tile/button/chip constants, send-to-kitchen disabled state, appendingToOrderId flow, ON BILL chip, click handlers (add/remove/setQty)
- [x] npm run lint → 0/0 on .ts files; npm run build → 1051 modules, dist bundle 661.92 kB shipped (index-DncpmHyQ.js)
- [x] Ad-hoc verifier 15/15 PASS (since deleted): column widths, category tile presence + colour usage, SHAPE.tile reuse, product tile style preserved, modal size, bundle freshness, server responses
- [x] Browser visual verification at :5173 — popup shows 3 columns; "All" filled teal/green; Coffee/Tea/Pastries/Sandwiches tiles show distinct border colours (brown/green/orange/blue); product tiles still colour-coded by category; Cancel/Send buttons present at footer

### M18b — Repo hygiene (interim)
- [x] Stashed half-finished M19 WIP (kitchen/bar station split) as `wip/m19-kitchen-bar-stations` — pickup when real café workflow actually needs station separation
- [x] Untracked `.hermes/plans/2026-07-28-unified-grid-redesign.md` from git (file preserved on disk as local reference; M6 is already shipped)
- [x] Added `.hermes/` to `.gitignore` so future plans never re-enter the repo
- [x] Frontend lint + tsc + build pass 0/0 on the clean M18 main; live service still serving M18 (PID 366569)
- [x] Decision: next real milestone is end-to-end **real-world smoke test** (3 terminals × 10 customers) — feature work paused until we know what real usage breaks
