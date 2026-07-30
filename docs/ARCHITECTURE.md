# Brew-POS — Architecture

## Design Goals

1. **Modular** — Each layer can be swapped without touching the rest.
2. **Portable** — One file (`brewpos.db`) + one command. Runs anywhere with Python and Node.
3. **Multi-terminal** — Any number of cashier/waiter/kitchen terminals share state via WebSocket.
4. **Touch-friendly** — Big buttons, large hit targets, dark theme, rounded corners.
5. **Production-ready foundation** — JWT auth, proper ORM, type-safe APIs, error handling.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Terminal (browser) — Vite/React + MUI + Redux Toolkit       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Login    │  │ Cashier  │  │ Waiter   │  │ Kitchen  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│       │              │              │              │         │
│       └──────────────┴──────┬───────┴──────────────┘         │
│                            │                                 │
│            ┌───────────────┴───────────────┐                 │
│            │   Axios HTTP + WS client     │                 │
│            └───────────────┬───────────────┘                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  FastAPI (uvicorn)   │
                  │  /api/*  +  /ws      │
                  │  (single port)       │
                  └──────────┬───────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
   ┌──────────────────┐         ┌──────────────────────┐
   │  Services layer  │         │  WebSocket hub       │
   │  (business       │         │  (ConnectionManager) │
   │   logic)         │         │                      │
   └────────┬─────────┘         └──────────────────────┘
            │
            ▼
   ┌──────────────────┐
   │  SQLAlchemy 2.0  │
   │  ORM             │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  SQLite          │
   │  (single file)   │
   └──────────────────┘
```

## Data Model

```
User ──────────< Order ──────────< OrderItem ──────────< OrderItemModifier
                   │                     │
                   │                     │
                   │                     ▼
                   │                 Product
                   │                     │
                   │                     ▼
                   │                 Category
                   │
                   ├────────────────< Payment
                   │
                   ▼
                 Table
```

### Key design choices

- **Price snapshots on OrderItem** — `OrderItem.price` and `OrderItemModifier.price_delta` are *snapshots* of the product's price at order time. Editing the menu later doesn't change historical orders.
- **`name` snapshot on OrderItem** — same reason: receipts must always show what was actually sold.
- **Single `OrderItemModifier` table** — modifiers are flattened. We don't need a per-option ID since the price/name is captured at order time.
- **Order status vs item status** — `Order.status` rolls up from the items but can be overridden. Allows the cashier to mark a whole order "served" even if items are still being made.
- **PIN-only auth** — no usernames. PIN is hashed with bcrypt. Terminals are usually shared between staff.

## State Synchronization

### WebSocket events

| Event | Trigger | Payload |
|-------|---------|---------|
| `hello` | Client connects | `{connections: N}` |
| `pong` | Any client message | `{connections: N}` |
| `order_created` | POST /api/orders/checkout | OrderOut |
| `order_updated` | PATCH /api/orders/{id} | OrderOut |

### Why a single WS hub, not per-room?

For a single-restaurant POS, the highest-value events (new orders, status changes) are relevant to ALL terminals. A single hub with broadcast is simpler than a per-room multiplexer. We can partition later (e.g., per-station) without changing the event payload.

### Frontend WS pattern

```ts
// frontend/src/lib/ws.ts — single shared client
class WSClient {
  connect() { /* auto-reconnect with backoff */ }
  on(handler) { /* subscribe to events */ }
}
```

Each page subscribes to events and re-fetches its data on relevant events. No client-side state merging — we trust the server as the source of truth.

## Security

- **JWT in `Authorization: Bearer`** header — Axios interceptor attaches it; 401 redirects to `/login`.
- **bcrypt-hashed PINs** — never plaintext.
- **JWT secret** in `BREWPOS_JWT_SECRET` — must be changed in production.
- **CORS** — currently `*`. Lock down with `BREWPOS_CORS_ORIGINS` per domain in production.
- **SQL injection** — SQLAlchemy's parameterized queries handle this.
- **No rate limiting** in the dev build. Add `slowapi` for production.

## Extensibility

### Add a new role
1. Add the role string to the seed.
2. Add a route in `backend/app/api/`.
3. Add a page in `frontend/src/pages/`.
4. Add a route case in `frontend/src/app/App.tsx`.

### Add a new endpoint
1. Add a Pydantic schema in `backend/app/schemas/__init__.py`.
2. Add a service function in `backend/app/services/__init__.py`.
3. Add a route in `backend/app/api/`.
4. Add the API call in `frontend/src/lib/api.ts`.

### Add a new WS event
1. In any service function, `await manager.broadcast("event_name", data)`.
2. In the frontend, `ws.on((event, data) => { if (event === 'event_name') ... })`.

### Swap SQLite for Postgres
Set `BREWPOS_DATABASE_URL=postgresql://user:pass@host:5432/brewpos` and re-run. No code changes needed; SQLAlchemy dialect handles the rest.

### Add payment provider integration
Create a new service module `backend/app/services/payments.py` with an abstract provider interface, then implement Stripe / Square / etc. The frontend's `payment_method` field already supports `cash | card | mobile` — extend with a provider ID.

## Performance

- SQLite handles ~100k orders comfortably. Switch to Postgres when you exceed that.
- The frontend bundle is 533 KB (gzip 170 KB). Code-splitting would help if you add many features.
- WS broadcasts trigger re-fetches. For high-traffic, switch to a merged "delta" event.

## Known Limitations

- **No multi-restaurant** — single DB, single venue. Add a `venue_id` column if you need more.
- **No offline mode** — terminals need an active connection. Add an outbox queue + IndexedDB for offline.
- **No printing** — receipt is a modal. Add an ESC/POS bridge for thermal printers.
- **No inventory deduction** — orders don't decrement stock. Add a hooks in `submit_order()`.
- **No discounts/taxes variants** — single tax rate (10%) hardcoded for now.
