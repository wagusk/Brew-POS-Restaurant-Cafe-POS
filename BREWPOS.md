# Brew-POS Condensed AI Reference

> Linux-native modular POS: FastAPI + SQLite + Vite/React + MUI.
> Run: `./run.sh` → http://localhost:8000 | Admin PIN: 9999

---

## 1. Stack Overview

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy 2.0, SQLite, JWT (python-jose), bcrypt |
| Frontend | Vite 5, React 18, TypeScript, MUI v6, Redux Toolkit, React Router 6 |
| Realtime | WebSocket hub (broadcasts order events to all terminals) |
| Roles | admin, master, cashier, waiter, kitchen, bar |

---

## 2. File Structure

```
Brew-POS/
├── backend/app/
│   ├── main.py              FastAPI entry, routers, static frontend
│   ├── core/
│   │   ├── config.py        Settings: taxes, discounts, DB URL, printer
│   │   ├── security.py      JWT auth, password hashing
│   │   └── permissions.py   PERMISSIONS catalog, role defaults
│   ├── models/              Role, User, Category, Product, Modifier*, Table, Order*, Payment
│   ├── schemas/             Pydantic DTOs (CheckoutIn, OrderOut, etc.)
│   ├── services/            Business logic (orders, checkout, close, void)
│   ├── api/
│   │   ├── auth.py          /api/auth/login, /me
│   │   ├── menu.py          /api/menu, /tables
│   │   ├── orders.py        /api/orders/* (checkout, close, cancel, void, print, stats)
│   │   ├── admin.py         /api/admin/* (CRUD, reports, bill-history)
│   │   └── settings.py      /api/admin/settings/* (tax, DB, printer, discount)
│   ├── ws/                  WebSocket endpoint /ws
│   └── db/                  session.py (engine, get_db), seed.py
├── frontend/src/
│   ├── pages/               Login, Cashier, Waiter, Kitchen, Bar, Admin, Settings, Dashboard
│   ├── lib/                 api.ts (fetch wrapper), ws.ts (socket), i18n/
│   ├── store/               Redux slices (auth, cart, menu)
│   ├── components/          Shell, ModifierModal
│   ├── app/                 App.tsx (routes, RoleRouter, PermissionRoute)
│   └── types/               Shared TS types
├── backend/brewpos.settings.json   Runtime config (taxes, discount, printer, DB)
└── docs/                    API.md, ARCHITECTURE.md, AUDIT.md, INSTALL.md
```

---

## 3. API Endpoints

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
| PUT | /api/admin/settings/text-size | Set UI text scale (0.8–1.5) |
| GET | /api/printer/status | Public printer status (mode + dry_run) |

---

## 4. Order Lifecycle

```
open → accepted → preparing → ready → served → paid
   ↓                              ↓
  (empty: deleted)              void
```

- Empty open bills (no items) → DELETED entirely (no record)
- Bill numbers recycled: lowest missing # from 1
- Void: status→void, totals zeroed, stays in DB, visible in history, excluded from reports
- Cancelled bills disappear from history

### OrderItem Status
```
new → preparing → ready → served
   ↓
  cancelled
```

- Station: kitchen | bar | both (from category.kind or product.kind)

---

## 5. Config System

### Tax Config
- `brewpos.settings.json` stores `taxes` list: `[{name, rate}, ...]`
- `get_tax_rate()` returns sum of all tax rates
- Legacy single `tax_rate` key still supported (fallback)

### Discount Policy
- `max_discount_pct` (0.50 default) — cap for cashiers
- `presets`: `[{label, mode:'amount'|'percent', value}]`
- `require_reason`: boolean

### Text Size (UI Scale)
- `text_size`: float 0.8–1.5 (1.0 = default)
- Applied via theme typography multiplier
- Adjustable in Settings page

### Settings Persistence
- File: `backend/brewpos.settings.json`
- Keys: taxes, discount_policy, printer, database_url, text_size
- Override via env: `BREWPOS_SETTINGS_FILE`
- Migrations: ALTER on startup (SQLite-safe)

---

## 6. Permissions

| Category | Permissions |
|----------|-------------|
| Page access | dashboard.view, cashier.view, waiter.view, kitchen.view, bar.view, menu.view, admin.view, settings.view |
| Task | order.open, order.close, order.cancel, order.discount, order.append, order.void, kitchen.serve, bar.serve |
| Admin | admin.manage_menu, manage_tables, manage_users, manage_settings, reports |

- Admin/master: full access; others: explicit grants only
- Per-user customization via permissions JSON array

---

## 7. Printer Config

- Mode: network | usb | dummy
- Paper: header_lines[], footer_lines[], cut_paper (bool)
- Auto-print: kitchen_ticket, customer_receipt
- Status endpoint: public, {mode, dry_run} only (no secrets)

---

## 8. Frontend Key Pages

| Page | Purpose |
|------|---------|
| CashierPage | Open bill, pay bill, printer status chip, reprint receipt |
| WaiterPage | Table grid, cart, submit order |
| KitchenPage/BarPage | Station display, mark served, reprint ticket |
| AdminPage | CRUD (users, products, tables, roles), reports, bill history |
| SettingsPage | Tax (multi-tax CRUD), Discount presets, Printer, Database |

---

## 9. Key Services (`backend/app/services/__init__.py`)

| Function | Purpose |
|----------|---------|
| `submit_order()` | Create order, single-bill-per-table guard |
| `close_order()` | Payment, empty bill delete, discount + tax calc |
| `cancel_order()` | Cancel or delete (if empty) |
| `void_order()` | Status→void, zero totals |
| `_next_order_number()` | Lowest missing # from 1 (recycles gaps) |
| `today_stats()` | today_revenue, today_orders, open_tickets, avg_ticket |

---

## 10. Config Helpers (`backend/app/core/config.py`)

| Helper | Purpose |
|--------|---------|
| `get_taxes()` | Get taxes list from settings |
| `set_taxes()` | Save taxes list |
| `get_tax_rate()` | Sum of all tax rates |
| `get_discount_policy()` | Get discount config |
| `set_discount_policy()` | Save discount config |
| `get_text_size()` | Get UI text scale |
| `set_text_size()` | Save UI text scale |
| `_load_persisted()` | Read brewpos.settings.json |
| `_persist()` | Atomic write to brewpos.settings.json |

---

## 11. WebSocket

- Endpoint: `/ws`
- Events: order.created, order.updated, order.closed, order.voided
- Frontend: `frontend/src/lib/ws.ts` (auto-reconnect)

---

## 12. i18n

- `frontend/src/lib/i18n/` — en.ts, id.ts (English + Bahasa)
- `useT()` hook for translations

---

## 13. Reports

- sales-summary, sales-by-category, item-sales, payment-methods
- bill-history: paid + void only (cancelled excluded), filter by period

---

## 14. Security

- JWT bearer tokens, bcrypt password hashing
- Role-based access control (RBAC) + per-user permissions
- Admin/master: full access; others: explicit grants only
- CORS: configured via settings.cors_origins

---

## 15. Key Conventions

- All timestamps: UTC ISO 8601
- Money: float (2 decimal places in UI)
- Status strings: lowercase (open, paid, void, etc.)
- API errors: `{ "detail": "message" }`
- Frontend state: Redux Toolkit (auth, cart, menu slices)
- Styling: MUI sx prop, SHAPE tokens (card: 12, button: 12, chip: 12)
- Theme: light mode, role-coded colors, 12px base radius

---

*Last updated: 2026-08-09*
