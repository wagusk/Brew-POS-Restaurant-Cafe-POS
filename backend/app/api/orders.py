"""Orders: checkout, list, status updates, accept, close, cancel."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import (
    CheckoutIn, OrderOut, OrderStatusIn, StatsOut, CloseOrderIn, CancelOrderIn, OpenBillIn, VoidOrderIn,
)
from app.models import User, Order
from app.core.security import current_user, require_role, require_permission
from app.core.permissions import can
from app.services import (
    submit_order, list_orders, get_order, update_order_status, to_order_out,
    today_stats, accept_order, close_order, cancel_order, append_items, open_bill, void_order,
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

    M23 — fires ONE chit per station that has items on this order.
    The kitchen chit only carries food items; the bar chit only carries
    drinks. Items routed to "both" appear on both chits as the same
    logical line so the displays stay in sync.
    """
    try:
        from app.services import tickets, printer
        for station in ("kitchen", "bar"):
            payload = tickets.build_station_ticket(db, order, station)
            if payload is None:
                continue
            result = printer.auto_print_on_event("on_send_to_kitchen", payload)
            if result is not None and not result.ok:
                log.warning(
                    "%s ticket for order #%s failed: %s",
                    station, order.number, result.error,
                )
    except Exception as e:  # never let printer failures escape the endpoint
        log.warning("kitchen/bar ticket for order #%s raised: %s", order.number, e)


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
async def checkout(payload: CheckoutIn, db: Session = Depends(get_db), user: User = Depends(require_permission("order.open"))):
    """Create a new order (open bill). Requires `order.open` permission."""
    try:
        order = submit_order(db, payload, user)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_created", out.model_dump())
    _fire_kitchen_ticket(db, order)
    return out


@router.post("/open-bill", response_model=OrderOut)
async def open_bill_endpoint(payload: OpenBillIn, db: Session = Depends(get_db), user: User = Depends(require_permission("order.open"))):
    """Open an empty bill on a table so it shows as open (blue tile) before any items exist."""
    try:
        order = open_bill(db, payload, user)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_created", out.model_dump())
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
    """Item-level status updates (preparing / ready / served).

    Requires kitchen.serve OR bar.serve depending on the item's station.
    Admin/master always have access.
    """
    if not can(user, "kitchen.serve") and not can(user, "bar.serve"):
        raise HTTPException(status_code=403, detail="Missing permission: kitchen.serve or bar.serve")
    try:
        order = update_order_status(db, order_id, payload.status, payload.item_id, payload.item_status)
    except ValueError as e:
        raise HTTPException(404 if "not found" in str(e).lower() else 400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    return out


@router.post("/{order_id}/accept", response_model=OrderOut)
async def accept_endpoint(order_id: int, db: Session = Depends(get_db), user: User = Depends(require_permission("kitchen.serve"))):
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
    user: User = Depends(require_permission("order.append")),
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
async def close_endpoint(order_id: int, payload: CloseOrderIn, db: Session = Depends(get_db), user: User = Depends(require_permission("order.close"))):
    """Cashier closes a bill. Records the payment and transitions the order to 'paid'.

    M21.1 — discount rules (two paths):
      • Preset path (cashier UX): the cashier passes `preset_label`
        which the backend resolves against the active policy. A
        matching preset is auto-converted to a dollar amount (amount
        presets use the stored value; percent presets compute against
        the bill subtotal). Resolved amount is capped at
        `max_discount_pct` of the subtotal — cashier DOES NOT need
        the `discount.apply` permission for this path.
      • Free-form path (admin UX): the caller passes a raw `discount`
        dollar amount + `discount_reason`. This still requires the
        `discount.apply` permission; cap check is bypassed for admins.
      • If `require_reason` is set in the discount policy and the
        caller didn't supply one, the request is rejected.
    """
    from app.core.config import get_discount_policy, resolve_preset_discount

    # 1. Resolve preset_label → dollar amount if provided.
    resolved_discount = max(0.0, float(payload.discount or 0))
    applied_reason = (payload.discount_reason or "").strip()
    preset_applied = False
    if payload.preset_label:
        policy = get_discount_policy()
        # Match by label (case-sensitive, full string). The cashier UX
        # passes exactly the label that's displayed on the button.
        match = next(
            (p for p in policy.get("presets", []) if p.get("label") == payload.preset_label),
            None,
        )
        if not match:
            raise HTTPException(
                404,
                f"Discount preset '{payload.preset_label}' not found in policy",
            )
        # Look up the subtotal first so percent presets resolve correctly.
        order_for_subtotal = db.get(Order, order_id)
        if not order_for_subtotal:
            raise HTTPException(404, "Order not found")
        resolved_discount = resolve_preset_discount(match, order_for_subtotal.subtotal)
        applied_reason = applied_reason or str(match.get("label") or "")
        preset_applied = True

    # 2. Permission gate — only required for FREE-FORM (admin) discounts.
    # Cashier-preset paths pass because admins configured the presets.
    if resolved_discount > 0 and not preset_applied:
        if "order.discount" not in (user.permissions or []):
            raise HTTPException(
                403,
                "You don't have permission to apply a discount. Ask an admin.",
            )

    # 3. Reason required?
    if resolved_discount > 0:
        policy = get_discount_policy()
        if policy.get("require_reason") and not applied_reason:
            raise HTTPException(400, "Discount reason is required")

    # 4. Apply via service.
    try:
        order = close_order(
            db, order_id,
            payload.payment_method, payload.tendered,
            discount=resolved_discount, discount_reason=applied_reason,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # M20-empty — close_order returns None when the bill was empty and
    # deleted entirely (no record kept).
    if order is None:
        await manager.broadcast("order_deleted", {"order_id": order_id})
        return JSONResponse(
            {"detail": "Empty bill deleted — no record kept", "order_id": order_id},
            status_code=200,
        )

    # 5. Max-cap guard for non-admin cashiers using the preset path.
    if order.discount > 0 and user.role != "admin":
        policy = get_discount_policy()
        cap = float(policy.get("max_discount_pct", 0)) * order.subtotal
        if order.discount > cap + 0.005:  # tolerance for float rounding
            raise HTTPException(
                400,
                f"Discount ${order.discount:.2f} exceeds the {policy['max_discount_pct']*100:.0f}% cap (${cap:.2f})",
            )

    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    _fire_customer_receipt(db, order)
    return out


@router.post("/{order_id}/cancel", response_model=OrderOut)
async def cancel_endpoint(
    order_id: int,
    payload: CancelOrderIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("order.cancel")),
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

    # M20-empty — cancel_order returns None when the bill was empty and
    # deleted entirely.
    if order is None:
        await manager.broadcast("order_deleted", {"order_id": order_id})
        return JSONResponse(
            {"detail": "Empty bill deleted — no record kept", "order_id": order_id},
            status_code=200,
        )

    out = to_order_out(order)
    # Use a dedicated event so other terminals (cashier, waiter) can
    # surface a "cancelled" toast instead of treating it as a normal
    # status update.
    await manager.broadcast(
        "order_cancelled" if payload.item_id is None else "order_item_cancelled",
        out.model_dump(),
    )
    return out


@router.post("/{order_id}/void", response_model=OrderOut)
async def void_endpoint(
    order_id: int,
    payload: VoidOrderIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("order.void")),
):
    """Admin voids an order. Status -> 'void'. Excluded from all reports."""
    try:
        order = void_order(db, order_id, payload.reason, user)
    except ValueError as e:
        raise HTTPException(400, str(e))
    out = to_order_out(order)
    await manager.broadcast("order_updated", out.model_dump())
    return out


@router.post("/{order_id}/print-ticket")
async def reprint_ticket_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    # M23 — accept either kitchen.view or bar.view so each station can
    # reprint its own chit without needing both permissions.
    user: User = Depends(current_user),
):
    """Manually re-fire the kitchen chit for an order.

    Same fire-and-forget pattern as the auto-print on /checkout, but the
    result is returned to the caller so the UI can show a success/error
    toast. Used when the printer jams, the chit is lost, or the kitchen
    needs a fresh copy of the prep list.

    M23 — the station is picked from the caller's role + permissions:
      - role='bar' or 'bar.view' without 'kitchen.view' → bar ticket
      - everyone else → kitchen ticket
    Callers with both permissions get the kitchen ticket (the primary
    prep line); the bar can always trigger its own via a second call.
    """
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(404, "Not found")
    perms = set(user.permissions or [])
    # Kitchen user with both perms → kitchen ticket. Kitchen role default
    # gives both kitchen.view + bar.view, so the kitchen role always gets
    # the kitchen chit (the primary prep line). Bar-only (just bar.view)
    # gets the bar chit. Admin / master get the kitchen chit too (they
    # can manually trigger the bar via the orders list / future UI).
    has_bar_only = "bar.view" in perms and "kitchen.view" not in perms
    has_any_station_perm = "bar.view" in perms or "kitchen.view" in perms
    if not (has_any_station_perm or user.role in ("admin", "master")):
        raise HTTPException(
            403,
            "Missing permission: kitchen.view or bar.view required to reprint tickets",
        )
    station = "bar" if has_bar_only else "kitchen"
    try:
        from app.services import tickets, printer
        payload = tickets.build_station_ticket(db, order, station)
        if payload is None:
            raise HTTPException(
                400,
                f"No items for station '{station}' on this order — nothing to reprint",
            )
        result = printer.print_bytes(payload)
    except HTTPException:
        raise
    except Exception as e:
        log.warning("manual ticket reprint for order #%s raised: %s", order.number, e)
        raise HTTPException(500, f"Print failed: {e}") from e
    return result.to_dict()


@router.post("/{order_id}/print-receipt")
async def reprint_receipt_endpoint(
    order_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("cashier.view")),
):
    """Manually re-fire the customer receipt for a closed (paid) order.

    Used when the customer lost their receipt, the printer jammed, or
    the cashier needs a copy for the till tape.
    """
    order = get_order(db, order_id)
    if not order:
        raise HTTPException(404, "Not found")
    if order.status != "paid":
        raise HTTPException(400, "Receipt can only be reprinted for paid orders")
    try:
        from app.services import tickets, printer
        payload = tickets.build_customer_receipt(db, order)
        result = printer.print_bytes(payload)
    except Exception as e:
        log.warning("manual receipt reprint for order #%s raised: %s", order.number, e)
        raise HTTPException(500, f"Print failed: {e}") from e
    return result.to_dict()


@router.get("/_stats/today", response_model=StatsOut)
def stats(db: Session = Depends(get_db), user: User = Depends(require_role("admin", "cashier"))):
    return StatsOut(**today_stats(db))