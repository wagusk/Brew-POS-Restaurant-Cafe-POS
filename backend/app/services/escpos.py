"""ESC/POS byte-stream builder for 58/80mm thermal receipt printers.

Targets the generic Epson-compat subset that works on ~95% of cheap thermal
receipt printers (Epson, Star, Citizen, generic Chinese clones). No third-party
deps — only the stdlib.

Usage:
    from app.services.escpos import TicketBuilder, fmt_thermal

    builder = TicketBuilder(width='80mm')
    builder.header("Brew-POS", bold=True, double_size=True, center=True)
    builder.blank()
    builder.row("Cappuccino x2", "$6.00", bold=False)
    builder.feed(2)
    builder.cut()

    bytes_to_send = builder.build()
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Iterable


# ── ESC/POS control codes ─────────────────────────────────────────────
ESC = b"\x1b"
GS  = b"\x1d"

INIT = ESC + b"@"             # ESC @ — initialize printer
CUT_FULL = GS + b"V\x00"      # GS V 0 — full cut
CUT_PART = GS + b"V\x01"      # GS V 1 — partial cut (leave a tab)
FEED_N   = lambda n: ESC + b"d" + bytes([n])  # ESC d n — feed n lines
NEWLINE  = b"\n"

# Text formatting (state toggles — call off() to revert)
BOLD_ON  = ESC + b"E\x01"
BOLD_OFF = ESC + b"E\x00"
UL_ON    = ESC + b"-\x01"
UL_OFF   = ESC + b"-\x00"
INV_ON   = GS  + b"B\x01"
INV_OFF  = GS  + b"B\x00"

# Size (nW × nH where n is 0..7; 0=normal, 1=double-width, etc.)
SIZE_NORMAL   = GS  + b"!\x00"
SIZE_DOUBLE_W = GS  + b"!\x10"
SIZE_DOUBLE_H = GS  + b"!\x01"
SIZE_DOUBLE   = GS  + b"!\x11"

# Alignment
ALIGN_LEFT   = ESC + b"a\x00"
ALIGN_CENTER = ESC + b"a\x01"
ALIGN_RIGHT  = ESC + b"a\x02"

# Codepage — most cheap 58/80mm clones with default ROM support CP437 + CP850.
# CP437 (1) covers English + most European chars in our menu names.
CODEPAGE_437 = ESC + b"t\x01"
CODEPAGE_850 = ESC + b"t\x02"


# ── Paper geometry ────────────────────────────────────────────────────
@dataclass(frozen=True)
class Paper:
    """Visible character columns per font. Conservative for cheap clones."""
    mm: int
    cols: int  # chars per line for normal-size text

    @classmethod
    def from_mm(cls, mm: int) -> "Paper":
        if mm == 58:
            return cls(mm=58, cols=32)
        # 80mm default
        return cls(mm=80, cols=42)


# ── Builder ───────────────────────────────────────────────────────────
@dataclass
class TicketBuilder:
    width: Paper = field(default_factory=lambda: Paper.from_mm(80))
    chunks: list[bytes] = field(default_factory=list)

    def __post_init__(self) -> None:
        # Always start with an init so prior state (bold, align, size) is reset.
        self.chunks.append(INIT + CODEPAGE_437)

    # ── raw control ───────────────────────────────────────────────────
    def raw(self, b: bytes) -> "TicketBuilder":
        self.chunks.append(b)
        return self

    def feed(self, n: int = 1) -> "TicketBuilder":
        self.chunks.append(FEED_N(max(0, min(n, 255))))
        return self

    def blank(self, n: int = 1) -> "TicketBuilder":
        self.chunks.append(NEWLINE * max(1, n))
        return self

    def cut(self, partial: bool = False) -> "TicketBuilder":
        # Always feed a couple of lines before cutting so the head isn't
        # pressing on the tear bar at the moment of cut.
        self.chunks.append(FEED_N(3) + (CUT_PART if partial else CUT_FULL))
        return self

    # ── formatting toggles (auto-revert on next call) ─────────────────
    def _emit(self, prefix: bytes, text: str, suffix: bytes) -> None:
        encoded = text.encode("cp437", errors="replace")
        self.chunks.append(prefix + encoded + suffix)

    def header(self, text: str, *, bold: bool = True, double_size: bool = False, center: bool = True) -> "TicketBuilder":
        prefix = ALIGN_CENTER if center else ALIGN_LEFT
        prefix += BOLD_ON if bold else b""
        prefix += SIZE_DOUBLE if double_size else SIZE_NORMAL
        suffix = SIZE_NORMAL + BOLD_OFF + ALIGN_LEFT
        self._emit(prefix, text + "\n", suffix)
        return self

    def footer(self, text: str, *, center: bool = True) -> "TicketBuilder":
        prefix = ALIGN_CENTER if center else ALIGN_LEFT
        self._emit(prefix, text + "\n", ALIGN_LEFT)
        return self

    def text(self, text: str, *, bold: bool = False, center: bool = False, double: bool = False) -> "TicketBuilder":
        prefix = (ALIGN_CENTER if center else ALIGN_LEFT)
        prefix += BOLD_ON if bold else b""
        prefix += SIZE_DOUBLE if double else SIZE_NORMAL
        suffix = SIZE_NORMAL + BOLD_OFF + ALIGN_LEFT
        self._emit(prefix, text + "\n", suffix)
        return self

    # ── rows (the workhorse of any receipt) ───────────────────────────
    def row(self, left: str, right: str, *, bold: bool = False, double: bool = False) -> "TicketBuilder":
        """Two-column row: left text left-aligned, right text right-aligned.

        If the combined length exceeds `self.width.cols`, the right column
        is truncated with a leading ellipsis so we never overrun the paper.
        """
        prefix = BOLD_ON if bold else b""
        prefix += SIZE_DOUBLE if double else SIZE_NORMAL
        suffix = SIZE_NORMAL + BOLD_OFF
        line = _format_two_col(left, right, self.width.cols)
        self.chunks.append(prefix + line.encode("cp437", errors="replace") + suffix + NEWLINE)
        return self

    def hr(self, char: str = "-") -> "TicketBuilder":
        """A dashed line spanning the full paper width."""
        self.chunks.append((char * self.width.cols + "\n").encode("cp437", errors="replace"))
        return self

    # ── output ────────────────────────────────────────────────────────
    def build(self) -> bytes:
        return b"".join(self.chunks)


# ── Helpers ───────────────────────────────────────────────────────────
def _format_two_col(left: str, right: str, width: int) -> str:
    """Pack `left` and `right` into a single line of `width` characters.

    The left column gets the slack; the right column is right-aligned and
    truncated with a leading ellipsis if it would overlap.
    """
    # Reserve at least 1 char gap.
    right_len = len(right)
    if right_len + 1 >= width:
        # Right column would consume everything — truncate it.
        keep = max(1, width - 2)
        right = "…" + right[-(keep):]
        right_len = len(right)
    left_space = width - right_len - 1
    if len(left) > left_space:
        left = left[: max(0, left_space - 1)] + "…"
    left = left.ljust(left_space)
    return left + " " + right


# ── Convenience: tiny receipt builders ────────────────────────────────
def fmt_currency(value: float) -> str:
    """Format a money value for receipts (e.g. $6.00, $-0.50)."""
    sign = "-" if value < 0 else ""
    return f"{sign}${abs(value):.2f}"


def kitchen_ticket_bytes(
    *,
    order_number: int,
    table_label: str | None,
    customer_name: str,
    notes: str,
    items: Iterable[dict],
    paper_width: int = 80,
) -> bytes:
    """Build the ESC/POS byte stream for a kitchen ticket.

    Each item dict: {name: str, qty: int|float, modifiers: list[str] | None}.
    """
    paper = Paper.from_mm(paper_width)
    b = TicketBuilder(width=paper)
    b.header(f"#{order_number}", bold=True, double_size=True, center=True)
    if table_label:
        b.text(f"Table: {table_label}", bold=True, center=True)
    if customer_name:
        b.text(customer_name, center=True)
    b.hr("=")
    for it in items:
        qty = it.get("qty", 1)
        name = it.get("name", "")
        b.row(f"{qty}× {name}", "", bold=True)
        for mod in (it.get("modifiers") or []):
            b.row("", f"  + {mod}", bold=False)
    if notes:
        b.blank()
        b.text(f"NOTE: {notes}", bold=True)
    b.feed(2)
    b.cut(partial=True)
    return b.build()


def receipt_bytes(
    *,
    business_name: str,
    order_number: int,
    table_label: str | None,
    items: Iterable[dict],          # {name, qty, unit_price}
    subtotal: float,
    tax: float,
    total: float,
    payment_method: str,
    tendered: float | None,
    change_due: float | None,
    paper_width: int = 80,
    header_lines: Iterable[str] = (),
    footer_lines: Iterable[str] = (),
    cut_paper: bool = True,
) -> bytes:
    """Build the ESC/POS byte stream for a customer receipt."""
    paper = Paper.from_mm(paper_width)
    b = TicketBuilder(width=paper)
    # Multi-line header (skip blanks). Rendered bold, normal size, centered.
    for line in header_lines:
        if line and line.strip():
            b.header(line, bold=True, double_size=False, center=True)
    # Business name + order number always appear (system identity, not user-editable).
    b.header(business_name, bold=True, double_size=True, center=True)
    b.text(f"Order #{order_number}", center=True)
    if table_label:
        b.text(f"Table: {table_label}", center=True)
    b.hr("-")
    for it in items:
        qty = it.get("qty", 1)
        name = it.get("name", "")
        unit = it.get("unit_price", 0.0)
        line_total = qty * unit
        b.row(f"{qty}× {name}", fmt_currency(line_total))
    b.hr("-")
    b.row("Subtotal", fmt_currency(subtotal))
    b.row("Tax", fmt_currency(tax))
    b.row("TOTAL", fmt_currency(total), bold=True, double=True)
    b.hr("=")
    b.row("Paid by", payment_method.upper())
    if tendered is not None:
        b.row("Tendered", fmt_currency(tendered))
    if change_due is not None and change_due > 0:
        b.row("Change", fmt_currency(change_due))
    b.feed(1)
    # Multi-line footer (skip blanks).
    for line in footer_lines:
        if line and line.strip():
            b.footer(line, center=True)
    b.feed(2)
    if cut_paper:
        b.cut()
    else:
        b.cut(partial=True)
    return b.build()
