# Brew-POS AI Reference (Condensed)

> Linux-native modular POS: FastAPI + SQLite + Vite/React + MUI.
> Run: `./run.sh` → http://localhost:8000 | Admin PIN: 9999

## Stack
- Backend: FastAPI, SQLAlchemy 2.0, SQLite, JWT (python-jose), bcrypt
- Frontend: Vite 5, React 18, TS, MUI v6, Redux Toolkit, React Router 6
- Real-time: WebSocket hub (order events → all terminals)
- Roles: admin, master, cashier, waiter, kitchen, bar

## File Map
```
Brew-POS/
├── backend/app/
│   ├── main.py          FastAPI entry, routers, static frontend
│   ├── core/
│   │   ├── config.py    Settings: taxes, discounts, DB URL, printer
│   │   ├── security.py  JWT auth, password hashing
│   │   └── permissions.py PERMISSIONS catalog, role defaults
│   ├── models/          Role, User, Category, Product, Modifier*, Table, Order*, Payment
│   ├── schemas/         Pydantic DTOs (CheckoutIn, OrderOut, etc.)
│   ├── services/        Business logic (orders, checkout, close, void)
│   ├── api/
│   │   ├── auth.py      /api/auth/login, /me
│   │   ├── menu.py      /api/menu, /tables
│   │   ├── orders.py    /api/orders/* (checkout, close, cancel, void, print, stats)
│   │   ├── admin.py     /api/admin/* (CRUD, reports, bill-history)
│   │   └── settings.py  /api/admin/settings/* (tax, DB, printer, discount)
│   └── ws/hub.py        WebSocket endpoint /ws
├── frontend/src/
│   ├── pages/           Login, Cashier, Waiter, Kitchen, Bar, Admin, Settings, Dashboard
│   ├── lib/             api.ts (fetch wrapper), ws.ts (socket), i18n/
│   ├── store/           Redux slices (auth, cart, menu)
│   ├── components/      Shell, ModifierModal
│   └── types/           Shared TS types
└── docs/                API.md, ARCHITECTURE.md, AUDIT.md, INSTALL.md
```

## API Endpoints (key)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/auth/login | Login → JWT |
| GET | /api/menu | Full menu (cats + products + modifiers) |
| GET | /api/tables | All tables |
| POST | /api/orders/checkout | Create order (waiter flow) |
| POST | /api/orders/open-bill | Open empty bill (cashier flow) |
| GET | /api/orders | List orders (filter by status) |
| GET | /api/orders/:id | Order detail |
| POST | /api/orders/:id/accept | Accept order (kitchen) |
| POST | /api/orders/:id/items | Add items to existing bill |
| POST | /api/orders/:id/close | Close bill + payment |
| POST | /api/orders/:id/cancel | Cancel order (kitchen) |
| POST | /api/orders/:id/void | Void order (admin) |
| POST | /api/orders/:id/print-ticket | Print kitchen ticket |
| POST | /api/orders/:id/print-receipt | Print customer receipt |
| GET | /api/admin/reports/bill-history | Paid + void (cancelled excluded) |
| GET | /api/admin/settings | All settings (tax, DB, printer, discount) |
| PUT | /api/admin/settings/tax | Set multiple taxes [{name, rate}] |
| PUT | /api/admin/settings/discount | Discount policy |
| GET | /api/printer/status | Public printer status (mode + dry_run) |

## Order Lifecycle
```
open → accepted → preparing → ready → served → paid
   ↓                              ↓
  (empty: deleted)              void
```
- Empty open bills (no items) → DELETED entirely (no record)
- Bill numbers recycled: lowest missing # from 1
- Void: status→void, totals zeroed, stays in DB, visible in history, excluded from reports
- Cancelled bills disappear from history

## OrderItem Status
```
new → preparing → ready → served
   ↓
  cancelled
```
- Station: kitchen | bar | both (from category.kind or product.kind)

## Tax Config
- `brewpos.settings.json` stores `taxes` list: `[{name, rate}, ...]`
- `get_tax_rate()` returns sum of all tax rates
- Legacy single `tax_rate` key still supported (fallback)

## Discount Policy
- `max_discount_pct` (0.50 default) — cap for cashiers
- `presets`: `[{label, mode:'amount'|'percent', value}]`
- `require_reason`: boolean

## Permissions (PERMISSIONS tuple)
Page access: dashboard.view, cashier.view, waiter.view, kitchen.view, bar.view, menu.view, admin.view, settings.view
Task: order.open, order.close, order.cancel, order.discount, order.append, order.void, kitchen.serve, bar.serve
Admin: admin.manage_menu, manage_tables, manage_users, manage_settings, reports

## Settings Persistence
- File: `backend/brewpos.settings.json`
- Keys: taxes, discount_policy, printer, database_url
- Override via env: `BREWPOS_SETTINGS_FILE`
- Migrations: ALTER on startup (SQLite-safe)

## Printer Config
- Mode: network | usb | dummy
- Paper: header_lines[], footer_lines[], cut_paper (bool)
- Auto-print: kitchen_ticket, customer_receipt
- Status endpoint: public, {mode, dry_run} only (no secrets)

## Frontend Key Pages
- CashierPage: open bill, pay bill, printer status chip, reprint receipt
- WaiterPage: table grid, cart, submit order
- KitchenPage/BarPage: station display, mark served, reprint ticket
- AdminPage: CRUD (users, products, tables, roles), reports, bill history
- SettingsPage: Tax (multi-tax CRUD), Discount presets, Printer, Database

## Key Services (`backend/app/services/__init__.py`)
- `submit_order()`: create order, single-bill-per-table guard
- `close_order()`: payment, empty bill delete, discount + tax calc
- `cancel_order()`: cancel or delete (if empty)
- `void_order()`: status→void, zero totals
- `_next_order_number()`: lowest missing # from 1 (recycles gaps)
- `today_stats()`: today_revenue, today_orders, open_tickets, avg_ticket

## Config Helpers (`backend/app/core/config.py`)
- `get_taxes()`, `set_taxes()`, `get_tax_rate()` — multi-tax
- `get_discount_policy()`, `set_discount_policy()` — discount
- `get_printer_config()` — printer settings
- `_load_persisted()`, `_persist()` — atomic JSON read/write

## WebSocket
- Endpoint: `/ws`
- Events: order.created, order.updated, order.closed, order.voided
- Frontend: `frontend/src/lib/ws.ts` (auto-reconnect)

## i18n
- `frontend/src/lib/i18n/` — en.ts, id.ts (English + Bahasa)
- `useT()` hook for translations

## Reports
- sales-summary, sales-by-category, item-sales, payment-methods
- bill-history: paid + void only (cancelled excluded), filter by period

## Security
- JWT bearer tokens, bcrypt password hashing
- Role-based access control (RBAC) + per-user permissions
- Admin/master: full access; others: explicit grants only
- CORS: configured via settings.cors_origins
