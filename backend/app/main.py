"""Brew-POS FastAPI entry. Serves both API and static frontend bundle."""
import logging
import sys

from fastapi import FastAPI
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path

from app.core.config import settings
from app.db.session import current_engine, Base, SessionLocal
from app.db.seed import run as run_seed
from app.models import User as UserModel
from app.api import auth, menu, orders, admin, settings as settings_api
from app.ws.hub import router as ws_router


# ── Logging ──────────────────────────────────────────────────────────────
# Uvicorn only wires its own access/error loggers by default. Our service
# modules (`brewpos.printer`, `brewpos.orders`, ...) need their own root
# so `log.info` actually reaches stdout (which systemd captures into
# `~/.hermes/brewpos.log`). Idempotent; uvicorn re-runs this code path
# per worker so this can't double-up handlers in practice.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    stream=sys.stdout,
)


def _bootstrap_default_admin() -> None:
    """First-run safety net: if the active DB has no users, run the seed.

    Production installs call `python -m app.db.seed` after creating the
    DB file, but this guarantees a fresh checkout-from-GitHub install
    works without an extra manual step.
    """
    try:
        sess = SessionLocal()
        try:
            if sess.query(UserModel).count() == 0:
                run_seed()
        finally:
            sess.close()
    except Exception:
        # Bootstrap is best-effort — surface real failures from the API.
        pass


def _migrate_user_permissions() -> None:
    """Small SQLite-safe migration for existing portable installations.

    Two responsibilities:
      1. Add the `permissions` JSON column to legacy installs that predate M14.
      2. Union any newly added role-default permissions into existing users,
         so extending the PERMISSIONS catalog (e.g. adding `bar.view` for the
         bar display) silently propagates to legacy kitchens — without
         overwriting the explicit permission set chosen by an admin.
    """
    engine = current_engine()
    if "users" not in inspect(engine).get_table_names():
        return
    columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "permissions" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN permissions JSON"))
    from app.core.permissions import default_permissions
    session = SessionLocal()
    try:
        dirty = False
        for user in session.query(UserModel).all():
            desired = set(default_permissions(user.role))
            current = set(user.permissions or [])
            if not current:
                # Fresh user — seed role defaults.
                user.permissions = sorted(desired)
                dirty = True
                continue
            # Append any catalog permissions the role should have but the
            # user is missing. Preserves any explicit removals the admin
            # made because we never drop permissions — only add.
            missing = desired - current
            if missing:
                user.permissions = sorted(current | missing)
                dirty = True
        if dirty:
            session.commit()
    finally:
        session.close()


def _migrate_station_columns() -> None:
    """Add the kitchen/bar routing columns if this DB predates M14.7."""
    engine = current_engine()
    tables = set(inspect(engine).get_table_names())

    if "categories" in tables:
        cat_cols = {c["name"] for c in inspect(engine).get_columns("categories")}
        if "kind" not in cat_cols:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE categories ADD COLUMN kind VARCHAR(20) DEFAULT 'kitchen' NOT NULL"))

    if "products" in tables:
        prod_cols = {c["name"] for c in inspect(engine).get_columns("products")}
        if "kind" not in prod_cols:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE products ADD COLUMN kind VARCHAR(20) DEFAULT NULL"))

    if "order_items" in tables:
        oi_cols = {c["name"] for c in inspect(engine).get_columns("order_items")}
        if "station" not in oi_cols:
            with engine.begin() as connection:
                connection.execute(text("ALTER TABLE order_items ADD COLUMN station VARCHAR(20) DEFAULT 'kitchen' NOT NULL"))

    # M21 — discount columns on orders (subtotal-discount=taxable base).
    # `create_all` doesn't add new columns to existing tables, so we
    # ALTER them on startup if missing.
    if "orders" in tables:
        order_cols = {c["name"] for c in inspect(engine).get_columns("orders")}
        with engine.begin() as connection:
            if "discount" not in order_cols:
                connection.execute(text("ALTER TABLE orders ADD COLUMN discount FLOAT DEFAULT 0.0 NOT NULL"))
            if "discount_reason" not in order_cols:
                connection.execute(text("ALTER TABLE orders ADD COLUMN discount_reason VARCHAR(120) DEFAULT '' NOT NULL"))

# Create tables on the active engine. Done eagerly at startup so the
# first request doesn't pay the schema-creation cost.
Base.metadata.create_all(bind=current_engine())
_migrate_user_permissions()
_migrate_station_columns()
_bootstrap_default_admin()

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(admin.router)
app.include_router(settings_api.router)
app.include_router(ws_router)


@app.get("/health")
def health():
    return {"ok": True, "app": settings.app_name}


# --- Static frontend (must be AFTER all api routes) ---
FRONTEND_DIST = settings.frontend_dist
if FRONTEND_DIST.exists():
    # Mount assets directory
    assets = FRONTEND_DIST / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/")
    def index():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        # Don't shadow API or websocket
        if full_path.startswith(("api", "ws", "docs", "openapi", "health", "assets")):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        file = FRONTEND_DIST / full_path
        if file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    def no_frontend():
        return JSONResponse({
            "app": settings.app_name,
            "message": "Frontend not built. Run `npm install && npm run build` in frontend/, or use ./scripts/dev.sh",
            "api_docs": "/docs",
        })
