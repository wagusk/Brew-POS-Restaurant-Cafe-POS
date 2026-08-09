"""Brew-POS configuration. Single source of truth."""
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BACKEND_DIR / "brewpos.db"

# ── Settings persistence ────────────────────────────────────────────
# Tax rate, database location, and discount policy live in a
# `settings.json` file. By default it sits beside the DB (under
# BACKEND_DIR) but a test or a different deployment can override via
# BREWPOS_SETTINGS_FILE — useful when running the API in CI against
# a tempdir.
SETTINGS_FILE = Path(
    os.environ.get("BREWPOS_SETTINGS_FILE", str(BACKEND_DIR / "brewpos.settings.json"))
)
DEFAULT_TAX_RATE = 0.10  # legacy single-rate fallback
DEFAULT_TAXES = [
    {"name": "VAT", "rate": 0.10},
    {"name": "Service", "rate": 0.05},
]


def get_taxes() -> list[dict]:
    """Active taxes list from persisted settings."""
    persisted = _load_persisted()
    if "taxes" in persisted:
        return persisted["taxes"]
    return DEFAULT_TAXES


def set_taxes(taxes: list[dict]) -> None:
    data = _load_persisted()
    data["taxes"] = taxes
    _persist(data)


def get_tax_rate() -> float:
    """Total tax rate — sum of all active tax rates."""
    return sum(float(t.get("rate", 0)) for t in get_taxes())

# ── Discount policy defaults (M21) ──────────────────────────────────
# `max_discount_pct` is the per-bill cap expressed as a fraction of
# subtotal. 0.50 means a cashier cannot discount more than 50% of the
# pre-tax subtotal without admin role. `presets` are quick-pick chips
# in the PaymentDialog (label + fixed dollar amount). Roles whose
# default permissions include `discount.apply` can apply ANY discount
# up to the cap; everyone else can only apply $0. Admins always have
# the permission and bypass the cap.
DEFAULT_DISCOUNT_POLICY = {
    "max_discount_pct": 0.50,
    # M21.1 — each preset is now `{label, mode, value}`. `mode` is
    # either "amount" (USD) or "percent" (0–100). The cashier's
    # PaymentDialog converts percent presets into the resolved dollar
    # amount against the bill subtotal at tap time.
    "presets": [
        {"label": "VIP", "mode": "amount", "value": 5.0},
        {"label": "Loyalty 10%", "mode": "percent", "value": 10.0},
        {"label": "Staff meal", "mode": "amount", "value": 3.0},
    ],
    "require_reason": True,
}


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


def set_tax_rate(rate: float) -> None:
    data = _load_persisted()
    data["taxes"] = [{"name": "Tax", "rate": max(0.0, min(1.0, float(rate)))}]
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


# ── Discount policy (M21.1) ───────────────────────────────────────────
def get_discount_policy() -> dict:
    """Active discount policy, persisted > defaults. Always returns a
    fully-defaulted dict (max_discount_pct, presets, require_reason)
    so callers don't have to merge.

    M21.1 — each preset is `{label, mode, value}` where `mode` is
    either `amount` (USD fixed dollars, e.g. {label: 'VIP', mode:
    'amount', value: 5.00}) or `percent` (0–100, e.g. {label: 'Loyalty
    10%', mode: 'percent', value: 10}). Older payloads with bare
    `{label, amount}` are auto-migrated to `mode='amount'`.
    """
    persisted = _load_persisted()
    stored = persisted.get("discount_policy") or {}
    return {
        "max_discount_pct": float(stored.get("max_discount_pct", DEFAULT_DISCOUNT_POLICY["max_discount_pct"])),
        "presets": [_normalise_preset(p) for p in (stored.get("presets") or DEFAULT_DISCOUNT_POLICY["presets"])],
        "require_reason": bool(stored.get("require_reason", DEFAULT_DISCOUNT_POLICY["require_reason"])),
    }


def _normalise_preset(p: dict | None) -> dict:
    """Coerce a persisted preset into the canonical
    {label, mode, value} shape. Falls back to `mode='amount'` when
    an older `{label, amount}`-style payload is found so the cashier
    UI keeps working on legacy JSON files.
    """
    if not isinstance(p, dict):
        return {"label": "", "mode": "amount", "value": 0.0}
    label = str(p.get("label", "")).strip()[:32]
    # New shape — present when caller already sent mode+value.
    if "mode" in p and "value" in p:
        mode = str(p.get("mode", "amount")).strip().lower()
        if mode not in ("amount", "percent"):
            mode = "amount"
        try:
            v = float(p.get("value", 0) or 0)
        except (TypeError, ValueError):
            v = 0.0
        if mode == "percent":
            v = max(0.0, min(100.0, v))
        else:
            v = max(0.0, v)
        return {"label": label, "mode": mode, "value": round(v, 2)}
    # Legacy shape — `{label, amount}` without `mode`/`value`.
    try:
        amount = float(p.get("amount", 0) or 0)
    except (TypeError, ValueError):
        amount = 0.0
    return {"label": label, "mode": "amount", "value": round(max(0.0, amount), 2)}


def set_discount_policy(patch: dict) -> dict:
    """PATCH-style update of the discount policy. Unknown keys are
    silently dropped. Each field has a sensible default. Returns the
    merged policy.

    M21.1 — preset rows go through `_normalise_preset` so a mix of
    old (`{label, amount}`) and new (`{label, mode, value}`) shapes
    both round-trip correctly. Cap at 8 presets so the dialog
    doesn't overflow on tiny screens.
    """
    current = get_discount_policy()
    if "max_discount_pct" in patch and patch["max_discount_pct"] is not None:
        pct = max(0.0, min(1.0, float(patch["max_discount_pct"])))
        current["max_discount_pct"] = pct
    if "presets" in patch and patch["presets"] is not None:
        clean = []
        for p in patch["presets"]:
            row = _normalise_preset(p)
            if not row["label"]:
                continue
            if row["value"] <= 0:
                continue
            clean.append(row)
        current["presets"] = clean[:8]
    if "require_reason" in patch and patch["require_reason"] is not None:
        current["require_reason"] = bool(patch["require_reason"])
    data = _load_persisted()
    data["discount_policy"] = current
    _persist(data)
    return current


def resolve_preset_discount(preset: dict | None, subtotal: float) -> float:
    """Resolve a preset to a dollar amount given the bill's subtotal.
    `mode='amount'` returns the preset's stored value unchanged;
    `mode='percent'` returns `subtotal * percent / 100`. Returns 0
    when the preset is missing or invalid.
    """
    if not isinstance(preset, dict):
        return 0.0
    subtotal = float(subtotal or 0)
    row = _normalise_preset(preset)
    value = float(row.get("value", 0) or 0)
    if row.get("mode") == "percent":
        return round(max(0.0, subtotal) * (value / 100.0), 2)
    return round(max(0.0, value), 2)


def reset_persisted_settings() -> None:
    """Delete brewpos.settings.json. Used by the reset-db operation."""
    if SETTINGS_FILE.exists():
        SETTINGS_FILE.unlink()


# Patch the Settings class to add a tax_rate attribute so the .env
# override path still works without breaking the persisted-fallback.
if not hasattr(settings, "tax_rate"):
    type(settings).tax_rate = DEFAULT_TAX_RATE  # type: ignore[attr-defined]
