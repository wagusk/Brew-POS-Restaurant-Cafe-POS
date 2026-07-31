"""Orders: checkout, list, status updates, accept, close, cancel."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import (
    CheckoutIn, OrderOut, OrderStatusIn, StatsOut, CloseOrderIn, CancelOrderIn,
)
from app.models import User
from app.core.security import current_user, require_role, require_permission
from app.services import (
    submit_order, list_orders, get_order, update_order_status, to_order_out,
    today_stats, accept_order, close_order, cancel_order, append_items,
)
from app.schemas import AppendItemsIn
from app.ws import manager

log = logging.getLogger("brewpos.orders")

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _fire_kitchen_ticket(db: Session, order) -> None:
    """Print the kitchen chit if auto-print-on-send is enabled.

    Never raises. A print failure is logged at warning and otherwise
    silently dropped — the order must remain billable regardless of
    whether the chit reaches the kitchen thermal printer.
    """
    try:
        from app.services import tickets, printer
        payload = tickets.build_kitchen_ticket(db, order)
        result = printer.auto_print_on_event("on_send_to_kitchen", payload)
        if result is not None and not result.ok:
            log.warning(
                "kitchen ticket for order #%s failed: %s",
                order.number, result.error,
            )
    except Exception as e:  # never let printer failures escape the endpoint
        log.warning("kitchen ticket for order #%s raised: %s", order.number, e)


def _fire_customer_receipt(db: Session, order) -> None:
    """Print the customer receipt if auto-print-on-payment is enabled."""
    try:
        from app.services import tickets, printer
        payload = tickets.build_customer_receipt(db, order)
        result = printer.auto_print_on_event("on_payment", payload)
        if result is not None and not result.ok:
            log.warning(
                "customer receipt for order #%s failed: %s",
                order.number, result.error,
            )
    except Exception as e:
        log.warning("customer receipt for order #%s raised: %s", order.number, e)


@router.post("/checkout", response_model=OrderOut)
async def checkout(payload: CheckoutIn, db: Session = Depends(get_db), user: User = Depends(require_permission("waiter.view"))):
    """Waiter (or any role) sends a new order to the kitchen.

    Always creates the order in 'open' status with no payment. The cashier
    will close the bill once the kitchen has accepted the order.
    """
    try:
        order = submit_order(db, payload, user)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_created", out.model_dump())
    _fire_kitchen_ticket(db, order)
    return out


@router.get("", response_model=list[OrderOut])
def list_endpoint(
    status: str | None = None,
    limit: int = 100,
    station: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """List orders, filtered by role and optional station:

    - station=kitchen → orders with at least one kitchen item
    - station=bar     → orders with at least one bar item
    - cashier: only unpaid, already-accepted (or further-along) bills
    - kitchen role: defaults to station=kitchen
    - bar role:     defaults to station=bar (via admin permission)
    - waiter / admin: all orders (filterable with ?status= or ?station=)
    """
    role = user.role
    has_bar = "bar.view" in (user.permissions or [])
    if station is None and role == "kitchen":
        station = "kitchen"
    if station is None and role == "bar":
        station = "bar"
    if role == "cashier":
        orders = [
            o for o in list_orders(db, status=None, limit=limit, station=None)
            if o.status in ("accepted", "ready", "served")
        ]
    elif role in ("kitchen", "bar"):
        orders = [
            o for o in list_orders(db, status=None, limit=limit, station=station)
            if o.status in ("open", "accepted", "preparing", "ready")
        ]
    elif role == "waiter":
        orders = [o for o in list_orders(db, status=None, limit=limit) if o.status != "paid"]
    else:  # admin — see everything, optional ?status= and ?station=
        orders = list_orders(db, status=status, limit=limit, station=station)
    return [to_order_out(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_endpoint(order_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    o = get_order(db, order_id)
    if not o:
        raise HTTPException(404, "Not found")
    return to_order_out(o)


@router.patch("/{order_id}", response_model=OrderOut)
async def update_endpoint(order_id: int, payload: OrderStatusIn, db: Session = Depends(get_db), user: User = Depends(current_user)):
    """Item-level and intermediate status updates (preparing / ready / served).

    For 'accept' or 'close', use the dedicated endpoints below.
    """
    try:
        order = update_order_status(db, order_id, payload.status, payload.item_id, payload.item_status)
    except ValueError as e:
        raise HTTPException(404 if "not found" in str(e).lower() else 400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    return out


@router.post("/{order_id}/accept", response_model=OrderOut)
async def accept_endpoint(order_id: int, db: Session = Depends(get_db), user: User = Depends(require_permission("kitchen.view"))):
    """Kitchen acknowledges receipt of the order. open -> accepted."""
    try:
        order = accept_order(db, order_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    return out


@router.post("/{order_id}/items", response_model=OrderOut)
async def append_items_endpoint(
    order_id: int,
    payload: AppendItemsIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("waiter.view")),
):
    """Waiter appends items to an existing bill (single-bill-per-table UX)."""
    try:
        order = append_items(db, order_id, payload)
    except ValueError as e:
        raise HTTPException(404 if "not found" in str(e).lower() else 400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    return out


@router.post("/{order_id}/close", response_model=OrderOut)
async def close_endpoint(order_id: int, payload: CloseOrderIn, db: Session = Depends(get_db), user: User = Depends(require_permission("cashier.view"))):
    """Cashier closes a bill after the kitchen has accepted it.

    Records the payment and transitions the order to 'paid'.
    """
    try:
        order = close_order(db, order_id, payload.payment_method, payload.tendered)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    _fire_customer_receipt(db, order)
    return out


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_endpoint(
    order_id: int,
    payload: CancelOrderIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("kitchen.view")),
):
    """Kitchen cancels an order or a single item (e.g. sold-out).

    The reason is recorded in the order's notes for audit. Cancelled
    orders are excluded from both the kitchen and cashier work queues,
    so the rejected ticket disappears from the kitchen display
    immediately and the cashier no longer sees it as billable.
    """
    try:
        order = cancel_order(db, order_id, payload.reason, payload.item_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    # Use a dedicated event so other terminals (cashier, waiter) can
    # surface a "cancelled" toast instead of treating it as a normal
    # status update.
    await manager.broadcast(
        "order_cancelled" if payload.item_id is None else "order_item_cancelled",
        out.model_dump(),
    )
    return out


@router.get("/_stats/today", response_model=StatsOut)
def stats(db: Session = Depends(get_db), user: User = Depends(require_role("admin", "cashier"))):
    return StatsOut(**today_stats(db))