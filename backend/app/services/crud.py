"""CRUD service layer for admin-managed resources.

Kept thin — pure data operations. Route handlers enforce role checks.
"""
from __future__ import annotations
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.security import hash_pin
from app.core.permissions import default_permissions, normalise_permissions
from app.models import Category, Product, Table, User


# ---------- Categories ----------

def list_categories(db: Session) -> list[Category]:
    return db.scalars(select(Category).order_by(Category.sort, Category.name)).all()


def get_category(db: Session, cid: int) -> Category | None:
    return db.get(Category, cid)


def create_category(db: Session, *, name: str, color: str, icon: str, sort: int, kind: str = "kitchen") -> Category:
    cat = Category(name=name, color=color, icon=icon, sort=sort, kind=kind)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def update_category(db: Session, cid: int, *, name: str | None, color: str | None, icon: str | None, sort: int | None, kind: str | None = None) -> Category | None:
    cat = db.get(Category, cid)
    if not cat:
        return None
    if name is not None:
        cat.name = name
    if color is not None:
        cat.color = color
    if icon is not None:
        cat.icon = icon
    if sort is not None:
        cat.sort = sort
    if kind is not None:
        cat.kind = kind
    db.commit()
    db.refresh(cat)
    return cat


def delete_category(db: Session, cid: int) -> bool:
    cat = db.get(Category, cid)
    if not cat:
        return False
    # Refuse if products still belong to this category — admin should reassign first.
    in_use = db.scalar(select(Product.id).where(Product.category_id == cid).limit(1)) is not None
    if in_use:
        raise ValueError("Category has products — move or delete them first")
    db.delete(cat)
    db.commit()
    return True


# ---------- Products ----------

def list_products(db: Session) -> list[Product]:
    return db.scalars(select(Product).order_by(Product.sort, Product.name)).all()


def get_product(db: Session, pid: int) -> Product | None:
    return db.get(Product, pid)


def create_product(db: Session, *, name: str, description: str, price: float, category_id: int, image: str, active: bool, sort: int) -> Product:
    if not db.get(Category, category_id):
        raise ValueError(f"Category {category_id} not found")
    p = Product(
        name=name, description=description, price=price,
        category_id=category_id, image=image, active=active, sort=sort,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def update_product(
    db: Session, pid: int,
    *, name: str | None, description: str | None, price: float | None,
    category_id: int | None, image: str | None, active: bool | None, sort: int | None,
) -> Product | None:
    p = db.get(Product, pid)
    if not p:
        return None
    if name is not None:
        p.name = name
    if description is not None:
        p.description = description
    if price is not None:
        p.price = price
    if category_id is not None:
        if not db.get(Category, category_id):
            raise ValueError(f"Category {category_id} not found")
        p.category_id = category_id
    if image is not None:
        p.image = image
    if active is not None:
        p.active = active
    if sort is not None:
        p.sort = sort
    db.commit()
    db.refresh(p)
    return p


def delete_product(db: Session, pid: int) -> bool:
    p = db.get(Product, pid)
    if not p:
        return False
    db.delete(p)
    db.commit()
    return True


# ---------- Tables ----------

def list_tables(db: Session, *, include_inactive: bool = True) -> list[Table]:
    stmt = select(Table).order_by(Table.name)
    if not include_inactive:
        stmt = stmt.where(Table.active.is_(True))
    return db.scalars(stmt).all()


def create_table(db: Session, *, name: str, seats: int, active: bool) -> Table:
    t = Table(name=name, seats=seats, active=active)
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


def update_table(db: Session, tid: int, *, name: str | None, seats: int | None, active: bool | None) -> Table | None:
    t = db.get(Table, tid)
    if not t:
        return None
    if name is not None:
        t.name = name
    if seats is not None:
        t.seats = seats
    if active is not None:
        t.active = active
    db.commit()
    db.refresh(t)
    return t


def delete_table(db: Session, tid: int) -> bool:
    t = db.get(Table, tid)
    if not t:
        return False
    db.delete(t)
    db.commit()
    return True


# ---------- Users ----------

def list_users(db: Session) -> list[User]:
    return db.scalars(select(User).order_by(User.role, User.name)).all()


def count_products(db: Session) -> int:
    return db.scalar(select(func.count(Product.id))) or 0


def count_users(db: Session) -> int:
    return db.scalar(select(func.count(User.id))) or 0


def create_user(db: Session, *, name: str, pin: str, role: str, active: bool, permissions: list[str] | None = None) -> User:
    u = User(name=name, pin=hash_pin(pin), role=role, active=active, permissions=normalise_permissions(role, permissions))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def update_user(db: Session, uid: int, *, name: str | None, pin: str | None, role: str | None, permissions: list[str] | None = None, active: bool | None) -> User | None:
    u = db.get(User, uid)
    if not u:
        return None
    if name is not None:
        u.name = name
    if pin is not None:
        u.pin = hash_pin(pin)
    new_role = role if role is not None else u.role
    role_changed = role is not None and role != u.role
    if role is not None:
        u.role = role
    if permissions is not None:
        # Explicit override wins; persist exactly what the admin sent (post-whitelist).
        u.permissions = normalise_permissions(new_role, permissions)
    elif role_changed:
        # Role swapped without an explicit permissions payload → snap to the new role's defaults.
        u.permissions = default_permissions(new_role)
    if active is not None:
        u.active = active
    db.commit()
    db.refresh(u)
    return u


def delete_user(db: Session, uid: int) -> bool:
    u = db.get(User, uid)
    if not u:
        return False
    # Safety: don't allow deleting the last admin
    if u.role == "admin":
        admin_count = db.scalar(
            select(User.id).where(User.role == "admin", User.active.is_(True), User.id != uid).limit(1)
        )
        if admin_count is None:
            raise ValueError("Cannot delete the last active admin")
    db.delete(u)
    db.commit()
    return True