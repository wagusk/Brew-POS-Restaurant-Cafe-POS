"""SQLAlchemy engine + session. Supports in-place engine reload after the
admin changes the database URL via the Settings UI — no server restart."""
from __future__ import annotations
import threading
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from app.core.config import get_active_db_url


class Base(DeclarativeBase):
    pass


def _normalise_url(url: str) -> str:
    """Pin the DBAPI driver explicitly so SQLAlchemy never has to guess.

    Without this, a bare `postgresql://...` URL with both psycopg2 and
    psycopg installed would pick whichever registered first; we want
    psycopg (v3). The SQLite and MySQL paths are unchanged. We only
    rewrite scheme, never the rest of the URL, so user-supplied host/port/
    creds survive intact.
    """
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    if url.startswith("postgres://"):
        # `postgres://` is the legacy scheme some PaaS dashboards still emit.
        return "postgresql+psycopg://" + url[len("postgres://"):]
    return url


_lock = threading.Lock()
_engine: Engine = create_engine(
    _normalise_url(get_active_db_url()),
    connect_args={"check_same_thread": False} if get_active_db_url().startswith("sqlite") else {},
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=_engine, autoflush=False, autocommit=False)


def _build_engine(url: str) -> Engine:
    return create_engine(
        _normalise_url(url),
        connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
        pool_pre_ping=True,
    )


def reload_engine(url: Optional[str] = None) -> Engine:
    """Rebuild the SQLAlchemy engine bound to `url` (or the persisted active
    URL). Safe to call concurrently — uses an internal lock and disposes
    the old engine so its connection pool releases file handles.

    SQLite is fine to swap in-place; for a true multi-process server you'd
    want a per-process pool, but Brew-POS runs as a single uvicorn process.
    """
    global _engine, SessionLocal
    target = url or get_active_db_url()
    with _lock:
        try:
            _engine.dispose()
        except Exception:
            pass
        _engine = _build_engine(target)
        SessionLocal.configure(bind=_engine)
    # Create tables on the new engine in case the file is fresh.
    Base.metadata.create_all(bind=_engine)
    return _engine


def current_engine() -> Engine:
    return _engine


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
