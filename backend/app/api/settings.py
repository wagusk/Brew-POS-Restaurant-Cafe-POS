"""Admin settings: tax rate + database location + backup/restore.

This is the runtime knob layer — every value here is read fresh on
each request, so the cashier/waiter pages pick up changes immediately
without a server restart. Tax rate changes take effect on the next
order; database URL changes take effect on the next reload.
"""
from __future__ import annotations
import os
import re
import shutil
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session
from sqlalchemy import inspect as sa_inspect

from app.db.session import get_db, reload_engine, current_engine, Base
from app.db.seed import run as run_seed
from app.core.config import (
    BACKEND_DIR,
    DB_PATH,
    SETTINGS_FILE,
    DEFAULT_TAX_RATE,
    get_active_db_url,
    get_tax_rate,
    set_active_db_url,
    set_tax_rate,
    reset_persisted_settings,
    get_discount_policy,
    set_discount_policy,
)
from app.core.security import current_user, require_role
from app.models import User as UserModel
from app.services.crud import count_products, count_users
from app.services.printer import (
    DEFAULT_CONFIG as PRINTER_DEFAULTS,
    PrintResult,
    get_config as get_printer_config,
    get_status as get_printer_status,
    print_bytes,
    update_config as update_printer_config,
)

router = APIRouter(prefix="/api/admin/settings", tags=["settings"])


# ── Schemas ──────────────────────────────────────────────────────────
class TaxIn(BaseModel):
    tax_rate: float = Field(ge=0.0, le=1.0)


class DatabaseUrlIn(BaseModel):
    database_url: str = Field(min_length=8)

    @field_validator("database_url")
    @classmethod
    def _accept(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("sqlite://") or v.startswith("postgresql://") or v.startswith("mysql://")):
            raise ValueError(
                "URL must start with sqlite://, postgresql://, or mysql://"
            )
        return v


class SettingsOut(BaseModel):
    tax_rate: float
    database_url: str
    default_database_url: str
    db_kind: str           # 'sqlite' | 'postgresql' | 'mysql' | 'other'
    db_file_exists: bool
    product_count: int
    user_count: int
    # M21 — discount policy inline so the unified "Tax & Discounts"
    # admin menu only needs one GET to render both sections.
    discount_policy: dict


# ── Helpers ──────────────────────────────────────────────────────────
def _kind(url: str) -> str:
    if url.startswith("sqlite://"):
        return "sqlite"
    if url.startswith("postgresql://"):
        return "postgresql"
    if url.startswith("mysql://"):
        return "mysql"
    return "other"


def _file_path_for_sqlite(url: str) -> Path | None:
    """Return the filesystem path for a sqlite URL, or None."""
    if not url.startswith("sqlite://"):
        return None
    p = url[len("sqlite://"):]
    # SQLite URL may use `/abs/path`, `./rel`, or `:memory:`. Only file-backed URLs are portable.
    if p.startswith("/") or p.startswith("."):
        return Path(p).resolve()
    return None


def _ensure_settings_dir() -> None:
    """Create the data directory if a sqlite URL points somewhere new."""
    url = get_active_db_url()
    fp = _file_path_for_sqlite(url)
    if fp:
        fp.parent.mkdir(parents=True, exist_ok=True)


def _sqlite_filename_for_export(url: str) -> str:
    fp = _file_path_for_sqlite(url)
    if fp is None:
        return "brewpos.db"
    return fp.name


def _build_settings_out(db: Session) -> SettingsOut:
    url = get_active_db_url()
    fp = _file_path_for_sqlite(url)
    return SettingsOut(
        tax_rate=get_tax_rate(),
        database_url=url,
        default_database_url=f"sqlite:///{DB_PATH}",
        db_kind=_kind(url),
        db_file_exists=(fp.exists() if fp else True),
        product_count=count_products(db),
        user_count=count_users(db),
        discount_policy=get_discount_policy(),
    )


# ── Endpoints ────────────────────────────────────────────────────────
@router.get("", response_model=SettingsOut)
def get_settings(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    return _build_settings_out(db)


@router.put("/tax", response_model=SettingsOut)
def update_tax(payload: TaxIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    set_tax_rate(payload.tax_rate)
    return _build_settings_out(db)


@router.put("/database", response_model=SettingsOut)
def update_database(payload: DatabaseUrlIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    """Persist a new DB URL but do NOT switch the live engine yet. The
    admin still has to confirm with /database/reload — this keeps a
    bad URL from breaking checkout for everyone."""
    set_active_db_url(payload.database_url)
    return _build_settings_out(db)


@router.post("/database/reload", response_model=SettingsOut)
def reload_database(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    """Swap the engine to the persisted DB URL and create tables if needed.
    If the target is empty SQLite the seed runs automatically."""
    url = get_active_db_url()
    _ensure_settings_dir()
    try:
        reload_engine(url)
    except Exception as e:
        raise HTTPException(400, f"Failed to bind to {url}: {e}")
    # If the new DB has no users, run the seed.
    from app.db.session import SessionLocal
    sess = SessionLocal()
    try:
        if count_users(sess) == 0:
            run_seed()
    finally:
        sess.close()
    return _build_settings_out(db)


@router.post("/database/reset", response_model=SettingsOut)
def reset_database(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    """Drop every table in the active DB, recreate the schema, and re-seed.
    Data on disk is wiped — caller must confirm via the UI dialog."""
    engine = current_engine()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    run_seed()
    return _build_settings_out(db)


@router.post("/database/restore-defaults")
def restore_default_settings(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    """Delete brewpos.settings.json so the next request falls back to the
    env-default DB URL and tax rate. Engine is then swapped to defaults."""
    reset_persisted_settings()
    reload_engine()
    run_seed()
    # Reload the page-level settings from defaults.
    return _build_settings_out(db)


# ── Backup / Restore ─────────────────────────────────────────────────
@router.get("/database/export")
def export_database(user: UserModel = Depends(require_role("admin"))):
    """Return the SQLite file as a download. Other DB kinds are not
    exportable through this endpoint — use proper DB tooling instead."""
    url = get_active_db_url()
    if not url.startswith("sqlite://"):
        raise HTTPException(400, "Export is only supported for SQLite databases.")
    fp = _file_path_for_sqlite(url)
    if fp is None or not fp.exists():
        raise HTTPException(404, "No SQLite file at the active path.")
    return FileResponse(
        path=str(fp),
        filename=_sqlite_filename_for_export(url),
        media_type="application/octet-stream",
    )


class ImportIn(BaseModel):
    """Multi-part upload would be nicer, but the frontend posts JSON with
    base64 so we can keep the contract simple and curl-able from tests."""
    contents_b64: str = Field(min_length=8)


@router.post("/database/import", response_model=SettingsOut)
def import_database(payload: ImportIn, db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    """Replace the current SQLite file with the uploaded contents and
    swap the engine over. Caller must have exported from another
    Brew-POS instance (same schema)."""
    import base64
    url = get_active_db_url()
    if not url.startswith("sqlite://"):
        raise HTTPException(400, "Import is only supported for SQLite databases.")
    fp = _file_path_for_sqlite(url)
    if fp is None:
        raise HTTPException(400, "Active SQLite URL has no file path.")
    try:
        raw = base64.b64decode(payload.contents_b64, validate=True)
        # Sanity-check: SQLite files start with the magic header.
        if not raw.startswith(b"SQLite format 3"):
            raise ValueError("Not a SQLite file (bad magic header)")
    except Exception as e:
        raise HTTPException(400, f"Bad payload: {e}")

    # Backup the current file in case the import is bad.
    backup = fp.with_suffix(fp.suffix + ".bak")
    if fp.exists():
        shutil.copy2(fp, backup)
    fp.parent.mkdir(parents=True, exist_ok=True)
    fp.write_bytes(raw)
    # Swap engine so subsequent reads use the new file.
    reload_engine(url)
    return _build_settings_out(db)


# ── Printer settings ─────────────────────────────────────────────────
class PrinterSettingsOut(BaseModel):
    """Mirror of `printer.DEFAULT_CONFIG`. Returned by GET so the
    frontend (and the admin curl-driven smoke test) always sees a
    fully-defaulted config, even on a brand-new install.
    """
    mode: str
    network: dict
    usb: dict
    paper: dict
    auto_print: dict
    dry_run: bool


class PrinterSettingsIn(BaseModel):
    """PATCH-style input. Every field optional; missing fields are
    left untouched on disk.
    """
    mode: str | None = None
    network: dict | None = None
    usb: dict | None = None
    paper: dict | None = None
    auto_print: dict | None = None
    dry_run: bool | None = None

    @field_validator("mode")
    @classmethod
    def _mode_allowed(cls, v: str | None) -> str | None:
        if v is None:
            return v
        allowed = ("dummy", "network", "usb")
        if v not in allowed:
            raise ValueError(f"mode must be one of {allowed}")
        return v


class PrintResultOut(BaseModel):
    ok: bool
    mode: str
    dry_run: bool
    bytes_written: int
    elapsed_ms: int
    error: str | None = None


@router.get("/printer", response_model=PrinterSettingsOut)
def get_printer_settings(user: UserModel = Depends(require_role("admin"))):
    cfg = get_printer_config()
    return PrinterSettingsOut(**cfg)


@router.put("/printer", response_model=PrinterSettingsOut)
def update_printer_settings(payload: PrinterSettingsIn, user: UserModel = Depends(require_role("admin"))):
    patch = {k: v for k, v in payload.model_dump().items() if v is not None}
    cfg = update_printer_config(patch)
    return PrinterSettingsOut(**cfg)


@router.post("/printer/test", response_model=PrintResultOut)
def test_printer(db: Session = Depends(get_db), user: UserModel = Depends(require_role("admin"))):
    """Fire a tiny test ticket through the configured sender. Returns
    the PrintResult — including any error string — so the caller can
    confirm the printer is reachable without parsing server logs.
    """
    from app.services.tickets import build_test_ticket
    payload = build_test_ticket(db)
    res: PrintResult = print_bytes(payload)
    return PrintResultOut(**res.to_dict())


# ── Discount policy (M21) ──────────────────────────────────────────
class DiscountPresetIn(BaseModel):
    """M21.1 — a preset row is `{label, mode, value}` where mode is
    'amount' (USD) or 'percent' (0–100) and value carries the dollar
    amount or the percent accordingly. Cashier flow converts percent
    presets into a resolved dollar amount against the bill subtotal
    at close-time. Free-form discount dollar amounts sent by the
    admin still go through the legacy `discount` field on close.
    The shape validator below enforces `value <= 100` when the mode
    is percent (so a stray 250-percent typo is rejected at the
    boundary); unlimited dollar values for amount-mode."""
    label: str = Field(min_length=1, max_length=32)
    mode: str = Field(default="amount", pattern=r"^(amount|percent)$")
    value: float = Field(gt=0, le=10000)

    @model_validator(mode="after")
    def _cap_percent(self):
        if self.mode == "percent" and self.value > 100:
            raise ValueError("value must be <= 100 when mode='percent'")
        return self


class DiscountPolicyOut(BaseModel):
    """Mirror of `config.DEFAULT_DISCOUNT_POLICY`. Returned by GET so
    the admin UI always sees a fully-defaulted policy."""
    max_discount_pct: float
    presets: list[DiscountPresetIn]
    require_reason: bool


class DiscountPolicyIn(BaseModel):
    """PATCH-style input. Every field optional; missing fields are
    left untouched on disk."""
    max_discount_pct: float | None = Field(default=None, ge=0, le=1)
    presets: list[DiscountPresetIn] | None = None
    require_reason: bool | None = None


@router.get("/discount", response_model=DiscountPolicyOut)
def get_discount_settings(user: UserModel = Depends(require_role("admin"))):
    return DiscountPolicyOut(**get_discount_policy())


@router.put("/discount", response_model=DiscountPolicyOut)
def update_discount_settings(payload: DiscountPolicyIn, user: UserModel = Depends(require_role("admin"))):
    patch = payload.model_dump(exclude_none=True)
    return DiscountPolicyOut(**set_discount_policy(patch))
