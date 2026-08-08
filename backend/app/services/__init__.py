"""Business logic. Keep these lean — one service per resource."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Category, Product, ModifierGroup, ModifierOption, Table,
    Order, OrderItem, OrderItemModifier, Payment, User,
)
from app.schemas import CheckoutIn, CartItemIn, OrderOut, OrderItemOut, OrderItemModOut, PaymentOut
from app.core.config import get_tax_rate


# Status transitions allowed by cancel_order — kitchen may reject an order
# that hasn't been paid yet. Once `paid`, cancellation is impossible (the
# cashier owns that decision through close/refund flows).
CANCELLABLE_ORDER_STATUSES = ("open", "accepted", "preparing", "ready", "served")
CANCELLABLE_ITEM_STATUSES = ("new", "preparing", "ready")


# TAX_RATE is intentionally not cached — every checkout reads the
# configured rate so admins can change tax at runtime without restarting.
# When no admin override is set the rate is 10% (see config.DEFAULT_TAX_RATE).


def get_menu(db: Session) -> dict:
    cats = db.scalars(select(Category).order_by(Category.sort, Category.name)).all()
    products = db.scalars(
        select(Product)
        .where(Product.active.is_(True))
        .options(selectinload(Product.modifier_groups).selectinload(ModifierGroup.options))
        .order_by(Product.sort, Product.name)
    ).all()
    return {"categories": cats, "products": products}


def get_tables(db: Session) -> list[Table]:
    return db.scalars(select(Table).where(Table.active.is_(True)).order_by(Table.name)).all()


def _next_order_number(db: Session) -> int:
    last = db.scalar(select(func.max(Order.number))) or 0
    return last + 1


def _build_item_snapshot(db: Session, ci: CartItemIn) -> tuple[OrderItem, list[OrderItemModifier]]:
    product = db.get(Product, ci.product_id)
    if not product or not product.active:
        raise ValueError(f"Product {ci.product_id} unavailable")
    # Snapshot the station so the bill preserves the routing decision at
    # order time. The single value is one of:
    #   "kitchen"  → only kitchen display sees this item
    #   "bar"      → only bar display sees this item
    #   "both"     → both displays see this item as the SAME logical line
    #                (so a "coffee + dessert" combo shows on both boards
    #                 with one shared progress)
    # Resolution order: product.kind (per-item override) → category.kind
    # → "kitchen" (the legacy default so old products keep routing).
    product_kind = product.kind
    category_kind = product.category.kind if product.category else "kitchen"
    if product_kind in ("kitchen", "bar", "both"):
        station = product_kind
    elif category_kind in ("kitchen", "bar", "both"):
        station = category_kind
    else:
        station = "kitchen"
    item = OrderItem(
        product_id=product.id,
        name=product.name,
        price=product.price,
        qty=ci.qty,
        notes=ci.notes,
        station=station,
    )
    mods: list[OrderItemModifier] = []
    for opt_id in ci.modifiers:
        opt = db.get(ModifierOption, opt_id)
        if opt:
            mods.append(OrderItemModifier(name=opt.name, price_delta=opt.price_delta))
    if mods:
        item.modifiers = mods
    return item, mods


def submit_order(db: Session, payload: CheckoutIn, user: User) -> Order:
    """Waiter sends a new order to the kitchen.

    The order is created in 'open' status. No payment is recorded — the
    cashier will close the bill once the kitchen has accepted the order.

    Single-bill-per-table rule: a table that already has an open or
    accepted bill cannot receive a new one. The waiter must add items
    to the existing bill instead. `dine_in` orders without `table_id`
    are not affected.
    """
    if payload.table_id is not None and payload.type == "dine_in":
        conflict = (
            db.query(Order)
            .filter(
                Order.table_id == payload.table_id,
                Order.status.in_(("open", "accepted", "preparing", "ready", "served")),
            )
            .first()
        )
        if conflict:
            raise ValueError(
                f"Table {payload.table_id} already has an open bill "
                f"#{conflict.number}. Open the existing bill to add items."
            )
    order = Order(
        number=_next_order_number(db),
        table_id=payload.table_id,
        type=payload.type,
        customer_name=payload.customer_name,
        notes=payload.notes,
        status="open",
        created_by=user.id,
    )
    subtotal = 0.0
    for ci in payload.items:
        item, mods = _build_item_snapshot(db, ci)
        item_subtotal = (item.price + sum(m.price_delta for m in mods)) * item.qty
        subtotal += item_subtotal
        order.items.append(item)
    order.subtotal = round(subtotal, 2)
    order.tax = round(subtotal * get_tax_rate(), 2)
    order.total = round(order.subtotal + order.tax, 2)

    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def append_items(db: Session, order_id: int, payload) -> Order:
    """Append more items to an existing bill (single-bill-per-table UX).

    Allowed as long as the bill hasn't been paid or cancelled. Recomputes
    subtotal/tax/total so the cashier's view stays accurate.
    """
    from app.schemas import AppendItemsIn
    if isinstance(payload, AppendItemsIn) is False and not hasattr(payload, 'items'):
        raise ValueError("Invalid payload")
    order = db.get(Order, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.status in ("paid", "void", "cancelled"):
        raise ValueError(f"Cannot append to a {order.status} bill")

    extra_subtotal = 0.0
    for ci in payload.items:
        item, mods = _build_item_snapshot(db, ci)
        item_subtotal = (item.price + sum(m.price_delta for m in mods)) * item.qty
        extra_subtotal += item_subtotal
        order.items.append(item)

    order.subtotal = round(order.subtotal + extra_subtotal, 2)
    order.tax = round(order.subtotal * get_tax_rate(), 2)
    order.total = round(order.subtotal + order.tax, 2)
    db.commit()
    db.refresh(order)
    return order


def accept_order(db: Session, order_id: int) -> Order:
    """Kitchen acknowledges receipt of an order. open -> accepted.

    Once accepted, the bill becomes visible to the cashier so they can
    close it. Item-level status can still be progressed through
    preparing/ready/served by the kitchen afterwards.
    """
    order = db.get(Order, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.status != "open":
        raise ValueError(f"Cannot accept order in status '{order.status}'")
    order.status = "accepted"
    for item in order.items:
        if item.status == "new":
            item.status = "preparing"
            if item.sent_at is None:
                item.sent_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    return order


def close_order(
    db: Session, order_id: int,
    payment_method: str, tendered: float,
    discount: float = 0.0, discount_reason: str = "",
) -> Order:
    """Cashier closes an already-accepted bill. accepted -> paid.

    Records a Payment row. The order must have been accepted by the
    kitchen first; otherwise the cashier has nothing to bill yet.

    M21 — optionally apply a fixed-amount discount. The discount
    reduces the taxable base (tax recomputed on discounted subtotal)
    and the grand total. Permission + max-cap guards are enforced
    by the route handler before this service is called — see
    `api.orders.close_endpoint`.
    """
    order = db.get(Order, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.status not in ("accepted", "ready", "served"):
        raise ValueError(
            f"Cannot close order in status '{order.status}' — kitchen must accept first"
        )

    # Apply discount (negative amounts are silently clamped to 0)
    applied_discount = max(0.0, float(discount))
    order.discount = round(applied_discount, 2)
    order.discount_reason = (discount_reason or "")[:120]

    # Recompute totals: taxable base is subtotal minus discount, tax on
    # that, grand total = taxable + tax.
    taxable = max(0.0, order.subtotal - order.discount)
    order.tax = round(taxable * get_tax_rate(), 2)
    order.total = round(taxable + order.tax, 2)

    tendered_amount = tendered if tendered > 0 else order.total
    change = round(tendered_amount - order.total, 2)
    payment = Payment(
        order=order,
        method=payment_method,
        amount=order.total,
        tendered=tendered_amount,
        change=change,
    )
    order.payments.append(payment)
    order.status = "paid"
    db.commit()
    db.refresh(order)
    return order


def list_orders(db: Session, status: str | None = None, limit: int = 100, station: str | None = None) -> list[Order]:
    stmt = select(Order).options(
        selectinload(Order.items).selectinload(OrderItem.modifiers),
        selectinload(Order.payments),
    ).order_by(Order.created_at.desc()).limit(limit)
    if status:
        stmt = stmt.where(Order.status == status)
    if station:
        # Return orders that have at least one item the requested station
        # is responsible for. "both" items count for every station so the
        # same order appears on both displays (kitchen sees it for the
        # food items, bar sees it for the drinks, both see the "both"
        # items in the middle).
        if station == "kitchen":
            stmt = stmt.where(Order.items.any(OrderItem.station.in_(("kitchen", "both"))))
        elif station == "bar":
            stmt = stmt.where(Order.items.any(OrderItem.station.in_(("bar", "both"))))
        else:
            stmt = stmt.where(Order.items.any(OrderItem.station == station))
    return db.scalars(stmt).all()


def to_order_out(o: Order) -> OrderOut:
    return OrderOut(
        id=o.id, number=o.number, table_id=o.table_id, status=o.status,
        type=o.type, customer_name=o.customer_name, notes=o.notes,
        subtotal=o.subtotal, discount=o.discount, discount_reason=o.discount_reason,
        tax=o.tax, total=o.total,
        created_at=o.created_at, updated_at=o.updated_at,
        items=[
            OrderItemOut(
                id=i.id, product_id=i.product_id, name=i.name, price=i.price,
                qty=i.qty, status=i.status, notes=i.notes, sent_at=i.sent_at,
                station=i.station or "kitchen",
                modifiers=[OrderItemModOut(id=m.id, name=m.name, price_delta=m.price_delta) for m in i.modifiers],
            ) for i in o.items
        ],
        payments=[
            PaymentOut(
                id=p.id, order_id=p.order_id, method=p.method, amount=p.amount,
                tendered=p.tendered, change=p.change, created_at=p.created_at,
            ) for p in o.payments
        ],
    )


def get_order(db: Session, order_id: int) -> Order | None:
    return db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .options(
            selectinload(Order.items).selectinload(OrderItem.modifiers),
            selectinload(Order.payments),
        )
    )


def update_order_status(db: Session, order_id: int, status: str | None, item_id: int | None, item_status: str | None) -> Order:
    """Progress an order's lifecycle. Refuses to set 'accepted' or 'paid' — those
    transitions go through the dedicated accept_order / close_order endpoints.
    Use cancel_order for the 'cancelled' transition (records a reason)."""
    order = db.get(Order, order_id)
    if not order:
        raise ValueError("Order not found")
    if status:
        if status in ("accepted", "paid"):
            raise ValueError(
                f"Use the dedicated endpoint to set '{status}' (accept or close order)"
            )
        order.status = status
    if item_id and item_status:
        item = db.get(OrderItem, item_id)
        if item and item.order_id == order.id:
            item.status = item_status
    # Auto-bump order.status to 'served' when ALL items are served/cancelled
    # so the cashier can close the bill. This runs regardless of which station
    # triggered the update.
    if item_status in ("served", "cancelled"):
        db.refresh(order)
        if all(i.status in ("served", "cancelled") for i in order.items):
            order.status = "served"
    db.commit()
    db.refresh(order)
    return order


def today_stats(db: Session) -> dict:
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    paid_today = db.scalars(
        select(Order).where(Order.status == "paid", Order.created_at >= today_start)
    ).all()
    open_count = db.scalar(
        select(func.count(Order.id)).where(Order.status.in_(["open", "accepted", "preparing", "ready"]))
    ) or 0
    revenue = sum(o.total for o in paid_today)
    n = len(paid_today)
    return {
        "today_orders": n,
        "today_revenue": round(revenue, 2),
        "open_tickets": open_count,
        "avg_ticket": round(revenue / n, 2) if n else 0.0,
    }


def cancel_order(db: Session, order_id: int, reason: str, item_id: int | None = None) -> Order:
    """Kitchen rejects an order (sold out, wrong order, etc.) or a single line item.

    When `item_id` is None the whole order transitions to `cancelled` and
    drops off the kitchen/cashier queues immediately. When `item_id` is
    set, only that item is cancelled — the rest of the order keeps
    cooking and the cashier bill is recomputed to exclude the rejected
    line.

    The reason is recorded in `order.notes` / `item.notes` so audit logs
    keep the explanation. The order's `status` is preserved when only an
    item is rejected, so a partially-cancelled order still flows through
    the rest of the kitchen pipeline normally.
    """
    order = db.get(Order, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.status not in CANCELLABLE_ORDER_STATUSES:
        raise ValueError(
            f"Cannot cancel order in status '{order.status}' — already paid or voided"
        )

    reason = (reason or "").strip() or "sold out"
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M")

    if item_id is not None:
        # Item-level cancellation
        item = db.get(OrderItem, item_id)
        if not item or item.order_id != order.id:
            raise ValueError(f"Item {item_id} not on order {order_id}")
        if item.status not in CANCELLABLE_ITEM_STATUSES:
            raise ValueError(
                f"Cannot cancel item in status '{item.status}'"
            )
        item.status = "cancelled"
        item.notes = (item.notes or "") + f"\n[CANCELLED {stamp}: {reason}]"
        # Recompute totals so the cashier doesn't bill the rejected line.
        _recompute_totals(db, order)
        db.commit()
        db.refresh(order)
        return order

    # Whole-order cancellation
    for item in order.items:
        if item.status in CANCELLABLE_ITEM_STATUSES:
            item.status = "cancelled"
    order.status = "cancelled"
    order.notes = (order.notes or "") + f"\n[CANCELLED {stamp}: {reason}]"
    # Zero out totals — a fully cancelled order is not billable.
    order.subtotal = 0.0
    order.tax = 0.0
    order.total = 0.0
    db.commit()
    db.refresh(order)
    return order


def _recompute_totals(db: Session, order: Order) -> None:
    """Recalculate subtotal/tax/total for `order`, excluding cancelled items."""
    active_subtotal = 0.0
    for item in order.items:
        if item.status == "cancelled":
            continue
        mod_total = sum(m.price_delta for m in item.modifiers)
        active_subtotal += (item.price + mod_total) * item.qty
    order.subtotal = round(active_subtotal, 2)
    order.tax = round(active_subtotal * get_tax_rate(), 2)
    order.total = round(order.subtotal + order.tax, 2)
