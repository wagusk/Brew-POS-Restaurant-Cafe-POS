"""Brew-POS configuration. Single source of truth."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BACKEND_DIR / "brewpos.db"

# ── Settings persistence ────────────────────────────────────────────
# Tax rate and database location live in a `settings.json` file. By
# default it sits beside the DB (under BACKEND_DIR) but a tests or a
# different deployment can override via BREWPOS_SETTINGS_FILE — useful
# when running the API in CI against a tempdir.
SETTINGS_FILE = Path(
    os.environ.get("BREWPOS_SETTINGS_FILE", str(BACKEND_DIR / "brewpos.settings.json"))
)
DEFAULT_TAX_RATE = 0.10  # 10% cafe tax — admin can change via the UI


def _load_persisted() -> dict:
    """Read brewpos.settings.json if it exists. Returns {} on any failure."""
    if not SETTINGS_FILE.exists():
        return {}
    try:
        import json
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _persist(data: dict) -> None:
    """Atomically write brewpos.settings.json so a mid-write crash
    can't leave the file half-written."""
    import json
    import os
    tmp = SETTINGS_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, SETTINGS_FILE)


class Settings(BaseSettings):
    app_name: str = "Brew-POS"
    database_url: str = f"sqlite:///{DB_PATH}"
    jwt_secret: str = "brewpos-dev-secret-change-me-please-32chars-min"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 12  # 12h working day
    frontend_dist: Path = BACKEND_DIR.parent / "frontend" / "dist"
    cors_origins: list[str] = ["*"]

    model_config = SettingsConfigDict(env_prefix="BREWPOS_", env_file=".env", extra="ignore")


settings = Settings()


# ── Public helpers used by services + endpoints ──────────────────────
def get_tax_rate() -> float:
    """Active tax rate, persisted > env > default."""
    persisted = _load_persisted()
    if "tax_rate" in persisted:
        try:
            return float(persisted["tax_rate"])
        except (TypeError, ValueError):
            pass
    env = settings.tax_rate if hasattr(settings, "tax_rate") else DEFAULT_TAX_RATE
    return float(env)


def set_tax_rate(rate: float) -> None:
    data = _load_persisted()
    data["tax_rate"] = max(0.0, min(1.0, float(rate)))
    _persist(data)


def get_active_db_url() -> str:
    """Active database URL, persisted > env > default."""
    persisted = _load_persisted()
    if persisted.get("database_url"):
        return persisted["database_url"]
    return settings.database_url


def set_active_db_url(url: str) -> None:
    """Persist a new database URL. The engine swap is performed by the
    endpoint that calls `reload_engine()`."""
    data = _load_persisted()
    data["database_url"] = url
    _persist(data)


def reset_persisted_settings() -> None:
    """Delete brewpos.settings.json. Used by the reset-db operation."""
    if SETTINGS_FILE.exists():
        SETTINGS_FILE.unlink()


# Patch the Settings class to add a tax_rate attribute so the .env
# override path still works without breaking the persisted-fallback.
if not hasattr(settings, "tax_rate"):
    type(settings).tax_rate = DEFAULT_TAX_RATE  # type: ignore[attr-defined]
