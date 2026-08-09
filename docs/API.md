# Brew-POS — API Reference

Base URL: `http://localhost:8000`
All `/api/orders/*` endpoints require a Bearer token (JWT) in the `Authorization` header unless noted.

## Auth

### POST /api/auth/login

Login with PIN.

**Request:**
```json
{ "pin": "1111" }
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": { "id": 2, "name": "Cashier", "role": "cashier" }
}
```

**Errors:**
- `401 Unauthorized` — wrong PIN

### GET /api/auth/me

Returns the current user. Requires bearer token.

**Response 200:**
```json
{ "id": 2, "name": "Cashier", "role": "cashier" }
```

---

## Menu

### GET /api/menu

Returns the full menu: categories and products with their modifier groups & options.

**Response 200:**
```json
{
  "categories": [
    { "id": 1, "name": "Coffee", "icon": "local_cafe", "color": "#8B5A2B", "sort": 0 }
  ],
  "products": [
    {
      "id": 1,
      "name": "Espresso",
      "description": "Single shot",
      "price": 2.50,
      "category_id": 1,
      "image": "",
      "active": true,
      "modifier_groups": [
        {
          "id": 1,
          "name": "Shot",
          "required": true,
          "multi": false,
          "options": [
            { "id": 1, "name": "Single", "price_delta": 0.0 },
            { "id": 2, "name": "Double", "price_delta": 0.5 }
          ]
        },
        {
          "id": 2,
          "name": "Milk",
          "required": false,
          "multi": true,
          "options": [
            { "id": 5, "name": "Regular", "price_delta": 0.0 },
            { "id": 6, "name": "Oat", "price_delta": 0.7 },
            { "id": 7, "name": "Almond", "price_delta": 0.7 }
          ]
        }
      ]
    }
  ]
}
```

### GET /api/tables

Returns the tables.

**Response 200:**
```json
[
  { "id": 1, "name": "T1", "seats": 4, "active": true }
]
```

---

## Orders

### POST /api/orders/open-bill

Open an empty bill on a table. The order is created with status `open`, zero items, and zero totals. The table now shows as "open" (blue tile) before any kitchen items exist.

**Request:**
```json
{
  "table_id": 3,
  "type": "dine_in",
  "customer_name": "",
  "notes": "Opened by cashier"
}
```

**Response 200:** OrderOut with `status: "open"`, `items: []`, `total: 0.0`. Also broadcasts `order_created` over WebSocket.

**Errors:**
- `400 Bad Request` — table already has an open bill

---

### POST /api/orders/checkout

Create a new order. The backend computes subtotal, tax (10%), and total from the items + modifiers.

**Request:**
```json
{
  "type": "dine_in",
  "table_id": 3,
  "customer_name": "Alice",
  "notes": "",
  "items": [
    {
      "product_id": 1,
      "qty": 2,
      "modifiers": [1, 6],
      "notes": ""
    }
  ],
  "payment_method": "cash",
  "tendered": 20.0
}
```

**Response 200:** OrderOut (see OrderOut schema below). Also broadcasts `order_created` over WebSocket.

### GET /api/orders?status=&limit=100

List recent orders, newest first. Optional filter by `status`.

### GET /api/orders/{id}

Get a single order with items + modifiers.

### PATCH /api/orders/{id}

Update order status or individual item status.

**Request:**
```json
{
  "status": "served"
}
```

or update an item:

```json
{
  "item_id": 5,
  "item_status": "ready"
}
```

Also broadcasts `order_updated` over WebSocket.

### POST /api/orders/{id}/void

Admin voids an order (mistake, wrong order, etc.). Status → `void`. Totals are zeroed. Voided orders are excluded from all reports and displays. Requires `order.void` permission.

**Request:**
```json
{
  "reason": "Duplicate order"
}
```

**Response 200:** OrderOut with `status: "void"`.

**Errors:**
- `400 Bad Request` — order not found or already voided

### GET /api/orders/_stats/today

**Auth:** admin or cashier only.

**Response 200:**
```json
{
  "today_orders": 2,
  "today_revenue": 21.01,
  "open_tickets": 0,
  "avg_ticket": 10.50
}
```

---

## WebSocket

### GET /ws

Connect to receive real-time events.

**Server → Client messages:**
```json
{ "event": "hello", "data": { "connections": 3 } }
{ "event": "pong", "data": { "connections": 3 } }
{ "event": "order_created", "data": { /* OrderOut */ } }
{ "event": "order_updated", "data": { /* OrderOut */ } }
```

**Client → Server:** any text payload (e.g., `"ping"`) is echoed back as `pong`.

**Reconnect:** the frontend client auto-reconnects with exponential backoff (max 10s).

---

## Schemas

### OrderOut
```json
{
  "id": 1,
  "number": 1,
  "table_id": 3,
  "status": "paid",
  "type": "dine_in",
  "customer_name": "",
  "notes": "",
  "subtotal": 9.40,
  "tax": 0.94,
  "total": 10.34,
  "created_at": "2026-07-28T12:52:41.734981",
  "updated_at": "2026-07-28T12:52:41.734988",
  "items": [
    {
      "id": 1,
      "product_id": 1,
      "name": "Espresso",
      "price": 2.50,
      "qty": 2,
      "status": "new",
      "notes": "",
      "sent_at": null,
      "modifiers": [
        { "id": 1, "name": "Single", "price_delta": 0.0 },
        { "id": 2, "name": "Almond", "price_delta": 0.7 }
      ]
    }
  ]
}
```

---

## Status flow

`Order.status`:
```
open → accepted → preparing → ready → served → paid
   ↓
  void
   ↓
  cancelled
```

`OrderItem.status`:
```
new → preparing → ready → served
   ↓
  void
   ↓
  cancelled
```

The cashier can **open a bill first** (empty, status=`open`), then the waiter adds items. Once all items are served, the order auto-bumps to `served`, then the cashier closes it → `paid`.

Admins can void any order at any status — totals are zeroed, the order is excluded from reports.


---

## Rate limits

None in development. In production, you'd want to add per-IP rate limiting on `/api/auth/login` (e.g., via `slowapi`).

---

## Health

`GET /health` → `{ "ok": true, "app": "Brew-POS" }`
