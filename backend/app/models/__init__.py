"""ORM models. Keep them flat - SQLite is the source of truth here."""
from __future__ import annotations
from datetime import datetime
from sqlalchemy import (
    String, Integer, Float, Boolean, ForeignKey, DateTime, Text, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.types import JSON

from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    pin: Mapped[str] = mapped_column(String(120))  # bcrypt hash
    role: Mapped[str] = mapped_column(String(20))  # admin | master | cashier | waiter | kitchen
    permissions: Mapped[list[str]] = mapped_column(MutableList.as_mutable(JSON), default=list)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    icon: Mapped[str] = mapped_column(String(40), default="restaurant")
    color: Mapped[str] = mapped_column(String(20), default="#5b8def")
    # `kind` routes orders to a station: kitchen | bar | both.
    # Admin can flip a category's station per-restaurant (e.g. move coffee
    # back to kitchen if the cafe doesn't have a dedicated bar).
    kind: Mapped[str] = mapped_column(String(20), default="kitchen")

    products: Mapped[list["Product"]] = relationship(back_populates="category", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    price: Mapped[float] = mapped_column(Float)
    # M27 — cost-of-goods per unit. Used by the reports profit calc
    # (revenue − Σ(qty × product.cost)). Stored as a per-unit dollar
    # amount, NOT a fraction. Defaults to 0 so existing products show
    # "no COGS tracked" until the admin fills it in — profit math
    # degrades gracefully (treats missing cost as $0).
    cost: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"))
    image: Mapped[str] = mapped_column(String(200), default="")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort: Mapped[int] = mapped_column(Integer, default=0)
    # `kind` overrides category's station routing: kitchen | bar | both | null (use category)
    kind: Mapped[str | None] = mapped_column(String(20), default=None)

    category: Mapped[Category] = relationship(back_populates="products")
    modifier_groups: Mapped[list["ModifierGroup"]] = relationship(
        back_populates="product", cascade="all, delete-orphan",
        order_by="ModifierGroup.sort"
    )


class ModifierGroup(Base):
    __tablename__ = "modifier_groups"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    multi: Mapped[bool] = mapped_column(Boolean, default=False)  # multi-select
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    sort: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="modifier_groups")
    options: Mapped[list["ModifierOption"]] = relationship(
        back_populates="group", cascade="all, delete-orphan", order_by="ModifierOption.sort"
    )


class ModifierOption(Base):
    __tablename__ = "modifier_options"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    price_delta: Mapped[float] = mapped_column(Float, default=0.0)
    group_id: Mapped[int] = mapped_column(ForeignKey("modifier_groups.id"))
    sort: Mapped[int] = mapped_column(Integer, default=0)

    group: Mapped[ModifierGroup] = relationship(back_populates="options")


class Table(Base):
    __tablename__ = "tables"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(40), unique=True)
    seats: Mapped[int] = mapped_column(Integer, default=4)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[int] = mapped_column(Integer, unique=True)  # human-friendly order number
    table_id: Mapped[int | None] = mapped_column(ForeignKey("tables.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="open")
    # open -> sent -> preparing -> ready -> served -> paid -> void
    type: Mapped[str] = mapped_column(String(20), default="dine_in")  # dine_in | takeaway
    customer_name: Mapped[str] = mapped_column(String(80), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    # M21 — discount applied at checkout. `discount` is the dollar amount
    # (always positive). `discount_reason` is free-form text from the
    # cashier explaining why (e.g. "VIP customer", "loyalty"). `discount`
    # reduces the taxable base so tax is charged on the discounted amount.
    discount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_reason: Mapped[str] = mapped_column(String(120), default="")
    tax: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderItem.id"
    )
    table: Mapped[Table | None] = relationship()
    payments: Mapped[list["Payment"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    name: Mapped[str] = mapped_column(String(120))  # snapshot
    price: Mapped[float] = mapped_column(Float)      # snapshot
    qty: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="new")  # new|preparing|ready|served
    notes: Mapped[str] = mapped_column(Text, default="")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # `station` is snapshotted at order time (from category.kind) so the
    # historical record is preserved when admin re-routes a category
    # later. Allowed values: kitchen | bar.
    station: Mapped[str] = mapped_column(String(20), default="kitchen")

    order: Mapped[Order] = relationship(back_populates="items")
    modifiers: Mapped[list["OrderItemModifier"]] = relationship(
        back_populates="item", cascade="all, delete-orphan"
    )


class OrderItemModifier(Base):
    __tablename__ = "order_item_modifiers"
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("order_items.id"))
    name: Mapped[str] = mapped_column(String(80))    # snapshot
    price_delta: Mapped[float] = mapped_column(Float, default=0.0)

    item: Mapped[OrderItem] = relationship(back_populates="modifiers")


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"))
    method: Mapped[str] = mapped_column(String(20))  # cash | card | mobile
    amount: Mapped[float] = mapped_column(Float)
    tendered: Mapped[float] = mapped_column(Float, default=0.0)
    change: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    order: Mapped[Order] = relationship(back_populates="payments")
