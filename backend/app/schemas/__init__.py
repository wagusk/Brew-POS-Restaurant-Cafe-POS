"""Pydantic schemas — request/response DTOs."""
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class LoginIn(BaseModel):
    pin: str = Field(min_length=3, max_length=8)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    role: str
    permissions: list[str] = []
    active: bool = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    icon: str
    color: str
    sort: int
    kind: str = "kitchen"


class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str
    price: float
    category_id: int
    image: str
    active: bool
    cost: float = 0.0  # M27 — COGS per unit, 0 if unset
    kind: str | None = None  # overrides category station routing


class ModOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    price_delta: float


class ModGroupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    required: bool
    multi: bool
    options: list[ModOptionOut]


class ProductWithMods(ProductOut):
    modifier_groups: list[ModGroupOut] = []


class MenuOut(BaseModel):
    categories: list[CategoryOut]
    products: list[ProductWithMods]


class CartItemIn(BaseModel):
    product_id: int
    qty: int = 1
    modifiers: list[int] = []  # list of modifier_option ids
    notes: str = ""


class CheckoutIn(BaseModel):
    table_id: int | None = None
    type: str = "dine_in"
    customer_name: str = ""
    notes: str = ""
    items: list[CartItemIn]
    payment_method: str = "cash"  # cash | card | mobile
    tendered: float = 0.0


class TableOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    seats: int
    active: bool


class OrderItemModOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    price_delta: float


class OrderItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    product_id: int
    name: str
    price: float
    qty: int
    status: str
    notes: str
    sent_at: datetime | None
    station: str = "kitchen"
    modifiers: list[OrderItemModOut] = []


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    order_id: int
    method: str
    amount: float
    tendered: float
    change: float
    created_at: datetime


class OrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    number: int
    table_id: int | None
    status: str
    type: str
    customer_name: str
    notes: str
    subtotal: float
    discount: float = 0.0
    discount_reason: str = ""
    tax: float
    total: float
    created_at: datetime
    updated_at: datetime
    items: list[OrderItemOut] = []
    payments: list[PaymentOut] = []


class OrderStatusIn(BaseModel):
    status: str | None = None
    item_id: int | None = None
    item_status: str | None = None


class CloseOrderIn(BaseModel):
    payment_method: str = "cash"  # cash | card | mobile
    tendered: float = 0.0
    # M21 — optional discount applied by the cashier at checkout.
    # Backward compatible: existing callers who send discount +
    # discount_reason keep working (free-form dollar discount,
    # admins only). New `preset_label` resolves to the matching
    # configured preset on the cashier side; the cashier converts
    # percent presets into a resolved dollar amount via the policy
    # API before sending. Discount reduces the taxable base so tax
    # is charged on the discounted amount (subtotal - discount + tax).
    discount: float = 0.0
    discount_reason: str = ""
    preset_label: str | None = None  # resolved server-side from policy


class CancelOrderIn(BaseModel):
    """Kitchen cancels an order or a single item (e.g. sold-out).

    `reason` is free-form text. When `item_id` is set, only that line
    item is cancelled; otherwise the whole order is cancelled. Cancelled
    orders are excluded from the kitchen and cashier work queues so they
    disappear from the kitchen display immediately.
    """
    reason: str = "sold out"
    item_id: int | None = None


class VoidOrderIn(BaseModel):
    """Admin voids an order (mistake, wrong order, etc.).

    A voided order is excluded from all reports and displays. Cannot
    void an already-voided order.
    """
    reason: str = ""


class AppendItemsIn(BaseModel):
    """Waiter appends items to an existing (open/accepted/preparing) bill.

    Used by the multi-bill UX where the waiter clicks an OpenBill tile,
    confirms, and then adds more menu items to the same bill rather than
    creating a second one (single-bill-per-table rule).
    """
    items: list[CartItemIn]


# ---------------------------------------------------------------------------
# Open Bill (M32) — create an empty bill on a table so it shows as "open"
# before any kitchen items exist. Used by the cashier when they need to
# start a bill manually.
# ---------------------------------------------------------------------------


class OpenBillIn(BaseModel):
    table_id: int
    type: str = "dine_in"
    customer_name: str = ""
    notes: str = ""


# ---------------------------------------------------------------------------
# Admin-managed resource CRUD (categories, products, tables, users)
# ---------------------------------------------------------------------------


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str = Field(default="#5b8def", pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str = "restaurant"
    sort: int = 0
    kind: str = Field(default="kitchen", pattern=r"^(kitchen|bar|both)$")


class CategoryUpdateIn(BaseModel):
    name: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    icon: str | None = None
    sort: int | None = None
    kind: str | None = Field(default=None, pattern=r"^(kitchen|bar|both)$")


class ProductIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = ""
    price: float = Field(ge=0)
    category_id: int
    image: str = ""
    active: bool = True
    sort: int = 0
    cost: float = Field(default=0.0, ge=0)  # M27 — COGS per unit
    kind: str | None = Field(default=None, pattern=r"^(kitchen|bar|both)$")  # overrides category kind


class ProductUpdateIn(BaseModel):
    name: str | None = None
    description: str | None = None
    price: float | None = Field(default=None, ge=0)
    category_id: int | None = None
    image: str | None = None
    active: bool | None = None
    sort: int | None = None
    cost: float | None = Field(default=None, ge=0)  # M27 — COGS per unit
    kind: str | None = Field(default=None, pattern=r"^(kitchen|bar|both)$")  # overrides category kind


class TableIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    seats: int = Field(default=4, ge=1)
    active: bool = True


class TableUpdateIn(BaseModel):
    name: str | None = None
    seats: int | None = Field(default=None, ge=1)
    active: bool | None = None


class UserIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    pin: str = Field(min_length=4, max_length=8)
    role: str = Field(pattern=r"^(admin|master|cashier|waiter|kitchen|bar)$")
    permissions: list[str] | None = None
    active: bool = True


class UserUpdateIn(BaseModel):
    name: str | None = None
    pin: str | None = Field(default=None, max_length=8)
    role: str | None = Field(default=None, pattern=r"^(admin|master|cashier|waiter|kitchen|bar)$")
    permissions: list[str] | None = None
    active: bool | None = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    label: str
    color: str
    sort: int
    active: bool = True


class RoleIn(BaseModel):
    name: str = Field(min_length=1, max_length=20)
    label: str = Field(min_length=1, max_length=40)
    color: str = Field(default="#5b8def", pattern=r"^#[0-9a-fA-F]{6}$")
    sort: int = 0


class RoleUpdateIn(BaseModel):
    name: str | None = None
    label: str | None = None
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    sort: int | None = None


class StatsOut(BaseModel):
    today_orders: int
    today_revenue: float
    open_tickets: int
    avg_ticket: float
