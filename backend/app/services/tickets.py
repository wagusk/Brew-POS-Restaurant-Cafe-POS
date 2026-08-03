"""Order → ESC/POS byte stream.

Pure functions only. No DB writes, no I/O. The caller (API layer) is
responsible for triggering the actual print via `printer.print_bytes`.

These helpers walk the SQLAlchemy relationship graph (`order.items`,
`order.table`, `order.payments`) and shape the data into the plain
dicts that `app.services.escpos` already understands.
"""
from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from app.models import Order
from app.services import escpos


# ── Station-scoped kitchen ticket ───────────────────────────────────
def build_station_ticket(db: Session, order: Order, station: str) -> bytes | None:
    """ESC/POS bytes for the chit printed at `station`.

    Filters `order.items` so only items the station should see end up on
    the chit:
      - station="kitchen" → items with station in ("kitchen", "both")
      - station="bar"     → items with station in ("bar", "both")

    Returns `None` when the order has no items for this station (so the
    caller can skip printing entirely — never fire an empty chit).
    """
    if station == "kitchen":
        allowed = ("kitchen", "both")
    elif station == "bar":
        allowed = ("bar", "both")
    else:
        return None
    items: list[dict] = []
    for it in order.items:
        if (it.station or "kitchen") not in allowed:
            continue
        if it.status in ("cancelled", "served"):
            continue
        mods = [m.name for m in it.modifiers]
        items.append({
            "name": it.name,
            "qty": it.qty,
            "modifiers": mods,
            "station": it.station,
        })
    if not items:
        return None
    return escpos.kitchen_ticket_bytes(
        order_number=order.number,
        table_label=order.table.name if order.table else None,
        customer_name=order.customer_name or "",
        notes=order.notes or "",
        items=items,
        paper_width=int(_paper_width(db)),
    )


# ── Backwards-compatible alias ─────────────────────────────────────
def build_kitchen_ticket(db: Session, order: Order) -> bytes:
    """Legacy single-chit entry point. Returns the kitchen ticket bytes
    even when `None` would be more correct — keeps M19 / M20 callers that
    didn't expect an Optional return working. New callers should use
    `build_station_ticket(...)` instead.
    """
    result = build_station_ticket(db, order, "kitchen")
    return result if result is not None else b""


# ── Customer receipt ───────────────────────────────────────────────
def build_customer_receipt(db: Session, order: Order) -> bytes:
    """ESC/POS bytes for the customer receipt printed on `POST /close`."""
    items: list[dict] = []
    for it in order.items:
        items.append({
            "name": it.name,
            "qty": it.qty,
            "unit_price": float(it.price),
        })
    # After the cashier closes the order there's at least one Payment.
    pay = order.payments[-1] if order.payments else None
    tendered = float(pay.tendered) if pay else None
    change = float(pay.change) if pay and pay.change > 0 else None
    return escpos.receipt_bytes(
        business_name="Brew-POS",
        order_number=order.number,
        table_label=order.table.name if order.table else None,
        items=items,
        subtotal=float(order.subtotal),
        tax=float(order.tax),
        total=float(order.total),
        payment_method=pay.method if pay else "",
        tendered=tendered,
        change_due=change,
        paper_width=int(_paper_width(db)),
        # M25 — escpos.receipt_bytes takes header_lines / footer_lines (plural,
        # list of strings), not the legacy header_text / footer_text (singular)
        # that M19-era code passed. The settings dict migration strips
        # header_text on load (see printer.py:99-101) but we still pass
        # the migrated lines here so the customer receipt honors whatever
        # the admin configured.
        header_lines=[_header_text(db)] if _header_text(db) else [],
        footer_lines=[_footer_text(db)] if _footer_text(db) else [],
    )


# ── Tiny test ticket (for the admin printer-self-test) ─────────────
def build_test_ticket(db: Session) -> bytes:
    """A small standalone ticket used by the admin's test-print button.

    Uses the configured paper width + header/footer text so the admin
    sees exactly what their printer will produce.
    """
    paper = escpos.Paper.from_mm(int(_paper_width(db)))
    b = escpos.TicketBuilder(width=paper)
    b.header(_header_text(db) or "Brew-POS", bold=True, double_size=True, center=True)
    b.text("PRINTER TEST", center=True)
    b.hr("-")
    b.row("This is a test ticket", "")
    b.row("If you can read this,", "")
    b.row("the printer is wired up.", "")
    b.hr("-")
    b.feed(2)
    b.cut()
    return b.build()


# ── Config helpers (read from the same settings.json the printer uses)
def _paper_width(db: Session) -> int:
    # Lazy import to avoid a hard dep on printer config in unit tests.
    from app.services.printer import get_config
    paper = (get_config().get("paper") or {}).get("width_mm", 80)
    return 58 if int(paper) == 58 else 80


def _header_text(db: Session) -> str:
    from app.services.printer import get_config
    return (get_config().get("paper") or {}).get("header_text", "")


def _footer_text(db: Session) -> str:
    from app.services.printer import get_config
    return (get_config().get("paper") or {}).get("footer_text", "")
