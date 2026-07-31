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


# ── Kitchen ticket ──────────────────────────────────────────────────
def build_kitchen_ticket(db: Session, order: Order) -> bytes:
    """ESC/POS bytes for the kitchen chit printed on `POST /checkout`.

    Items: only those not yet marked cancelled/void (their `status` is
    one of new / preparing / ready / served — i.e. anything the kitchen
    still has to act on). For a fresh checkout every item has status
    `new` so this list is everything.
    """
    items: list[dict] = []
    for it in order.items:
        # Touch `it.modifiers` so the lazy-load happens once, here.
        mods = [m.name for m in it.modifiers]
        items.append({
            "name": it.name,
            "qty": it.qty,
            "modifiers": mods,
        })
    return escpos.kitchen_ticket_bytes(
        order_number=order.number,
        table_label=order.table.name if order.table else None,
        customer_name=order.customer_name or "",
        notes=order.notes or "",
        items=items,
        paper_width=int(_paper_width(db)),
    )


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
        header_text=_header_text(db),
        footer_text=_footer_text(db),
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
