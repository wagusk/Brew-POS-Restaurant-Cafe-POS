"""Admin CRUD: categories, products, tables, users.

Read endpoints stay open (any logged-in user can browse menu/tables),
write endpoints require role=admin.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import (
    CategoryOut, ProductOut, TableOut, UserOut,
    CategoryIn, CategoryUpdateIn,
    ProductIn, ProductUpdateIn,
    TableIn, TableUpdateIn,
    UserIn, UserUpdateIn,
)
from app.models import User as UserModel
from app.core.security import require_role
from app.services import crud

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------- Categories ----------

@router.get("/categories", response_model=list[CategoryOut])
def list_categories_endpoint(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    return [CategoryOut.model_validate(c) for c in crud.list_categories(db)]


@router.post("/categories", response_model=CategoryOut)
def create_category_endpoint(payload: CategoryIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    try:
        cat = crud.create_category(
            db,
            name=payload.name,
            color=payload.color,
            icon=payload.icon,
            sort=payload.sort,
            kind=payload.kind,
        )
    except Exception as e:
        raise HTTPException(400, str(e))
    return CategoryOut.model_validate(cat)


@router.patch("/categories/{cid}", response_model=CategoryOut)
def update_category_endpoint(cid: int, payload: CategoryUpdateIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    cat = crud.update_category(
        db, cid,
        name=payload.name, color=payload.color, icon=payload.icon, sort=payload.sort,
        kind=payload.kind,
    )
    if not cat:
        raise HTTPException(404, "Category not found")
    return CategoryOut.model_validate(cat)


@router.delete("/categories/{cid}")
def delete_category_endpoint(cid: int, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    try:
        ok = crud.delete_category(db, cid)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not ok:
        raise HTTPException(404, "Category not found")
    return {"deleted": cid}


# ---------- Products ----------

@router.get("/products", response_model=list[ProductOut])
def list_products_endpoint(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    return [ProductOut.model_validate(p) for p in crud.list_products(db)]


@router.post("/products", response_model=ProductOut)
def create_product_endpoint(payload: ProductIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    try:
        p = crud.create_product(
            db, name=payload.name, description=payload.description, price=payload.price,
            category_id=payload.category_id, image=payload.image, active=payload.active, sort=payload.sort,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    return ProductOut.model_validate(p)


@router.patch("/products/{pid}", response_model=ProductOut)
def update_product_endpoint(pid: int, payload: ProductUpdateIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    try:
        p = crud.update_product(
            db, pid,
            name=payload.name, description=payload.description, price=payload.price,
            category_id=payload.category_id, image=payload.image, active=payload.active, sort=payload.sort,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not p:
        raise HTTPException(404, "Product not found")
    return ProductOut.model_validate(p)


@router.delete("/products/{pid}")
def delete_product_endpoint(pid: int, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    ok = crud.delete_product(db, pid)
    if not ok:
        raise HTTPException(404, "Product not found")
    return {"deleted": pid}


# ---------- Tables ----------

@router.get("/tables", response_model=list[TableOut])
def list_tables_endpoint(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    return [TableOut.model_validate(t) for t in crud.list_tables(db, include_inactive=True)]


@router.post("/tables", response_model=TableOut)
def create_table_endpoint(payload: TableIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    t = crud.create_table(db, name=payload.name, seats=payload.seats, active=payload.active)
    return TableOut.model_validate(t)


@router.patch("/tables/{tid}", response_model=TableOut)
def update_table_endpoint(tid: int, payload: TableUpdateIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    t = crud.update_table(db, tid, name=payload.name, seats=payload.seats, active=payload.active)
    if not t:
        raise HTTPException(404, "Table not found")
    return TableOut.model_validate(t)


@router.delete("/tables/{tid}")
def delete_table_endpoint(tid: int, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    ok = crud.delete_table(db, tid)
    if not ok:
        raise HTTPException(404, "Table not found")
    return {"deleted": tid}


# ---------- Users ----------

@router.get("/users", response_model=list[UserOut])
def list_users_endpoint(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    return [UserOut.model_validate(u) for u in crud.list_users(db)]


@router.post("/users", response_model=UserOut)
def create_user_endpoint(payload: UserIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    u = crud.create_user(
        db,
        name=payload.name,
        pin=payload.pin,
        role=payload.role,
        permissions=payload.permissions,
        active=payload.active,
    )
    return UserOut.model_validate(u)


@router.patch("/users/{uid}", response_model=UserOut)
def update_user_endpoint(uid: int, payload: UserUpdateIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    try:
        u = crud.update_user(
            db,
            uid,
            name=payload.name,
            pin=payload.pin,
            role=payload.role,
            permissions=payload.permissions,
            active=payload.active,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not u:
        raise HTTPException(404, "User not found")
    return UserOut.model_validate(u)


@router.delete("/users/{uid}")
def delete_user_endpoint(uid: int, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    try:
        ok = crud.delete_user(db, uid)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not ok:
        raise HTTPException(404, "User not found")
    return {"deleted": uid}