"""Printer service: write ESC/POS bytes to a physical printer.

Three modes:
  - 'network'  (default): raw TCP socket to printer_ip:printer_port (typically 9100).
  - 'usb'      : python-escpos + pyusb against a USB-connected printer.
                  Requires a udev rule on Linux to make the device accessible
                  to the FastAPI process user.
  - 'dummy'    : silently swallow the bytes. Used for local testing and when
                  a café is running without a printer yet. Returns success
                  like every other mode.

A 'dry_run' flag (independent of mode) forces the bytes to the server log
instead of the printer — useful for development verification.

This module never raises on print failure. Errors are logged and the call
returns a status dict that the API layer surfaces to the UI. A failed print
must NOT block sales.
"""
from __future__ import annotations

import json
import logging
import socket
import time
from dataclasses import dataclass
from typing import Any

from app.core.config import SETTINGS_FILE, _load_persisted, _persist

log = logging.getLogger("brewpos.printer")


# ── Result ────────────────────────────────────────────────────────────
@dataclass
class PrintResult:
    ok: bool
    mode: str
    dry_run: bool
    bytes_written: int
    error: str | None = None
    elapsed_ms: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.ok,
            "mode": self.mode,
            "dry_run": self.dry_run,
            "bytes_written": self.bytes_written,
            "elapsed_ms": self.elapsed_ms,
            "error": self.error,
        }


# ── Config ────────────────────────────────────────────────────────────
DEFAULT_CONFIG: dict[str, Any] = {
    "mode": "dummy",          # 'dummy' | 'network' | 'usb' | 'dry_run'
    "network": {
        "host": "127.0.0.1",
        "port": 9100,
        "timeout_sec": 2.0,
    },
    "usb": {
        "vendor_id": 0x04b8,  # Epson default; override for Star/clone
        "product_id": 0x0202,
    },
    "paper": {
        "width_mm": 80,
        # Multi-line header/footer rendered at the top/bottom of every receipt
        # and (for the header) on kitchen tickets. Editable from /settings.
        # Each list item is one printed line; empty strings are skipped.
        "header_lines": ["Brew-POS"],
        "footer_lines": ["Thank you!"],
        "cut_paper": True,  # GS V 0 (full cut) at end of receipt
    },
    "auto_print": {
        "on_send_to_kitchen": True,
        "on_payment": True,
    },
    "dry_run": False,
}


def _load_config() -> dict[str, Any]:
    """Load printer config from the shared settings JSON file.

    The file also holds tax_rate; we only mutate the 'printer' key. Missing
    key → start from DEFAULT_CONFIG. Corrupt JSON → log warning, fall back.

    Legacy single-string `header_text` / `footer_text` (M19) are auto-migrated
    to the new multi-line `header_lines` / `footer_lines` lists so existing
    installs keep working without a manual settings edit.
    """
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))  # deep copy
    all_settings = _load_persisted()
    stored = all_settings.get("printer") if isinstance(all_settings, dict) else None
    if isinstance(stored, dict):
        # Legacy single-string → list migration.
        legacy = stored.get("paper", {}) if isinstance(stored.get("paper"), dict) else {}
        if "header_lines" not in legacy and "header_text" in legacy:
            legacy["header_lines"] = [legacy["header_text"]] if legacy["header_text"] else []
            legacy.pop("header_text", None)
        if "footer_lines" not in legacy and "footer_text" in legacy:
            legacy["footer_lines"] = [legacy["footer_text"]] if legacy["footer_text"] else []
            legacy.pop("footer_text", None)
        stored["paper"] = legacy
        # Merge per-section so missing keys keep their defaults.
        for section, default_vals in DEFAULT_CONFIG.items():
            sec_in = stored.get(section)
            if isinstance(sec_in, dict) and isinstance(default_vals, dict):
                merged = dict(default_vals)
                merged.update(sec_in)
                cfg[section] = merged
            else:
                cfg[section] = sec_in if sec_in is not None else default_vals
    return cfg


def _save_config(cfg: dict[str, Any]) -> None:
    """Persist the printer section back to the shared settings JSON (atomically)."""
    all_settings = _load_persisted()
    all_settings["printer"] = cfg
    _persist(all_settings)


# ── Sender ────────────────────────────────────────────────────────────
class _Sender:
    """Pluggable byte writer. All implementations return bytes_written."""

    def __init__(self, mode: str, network: dict[str, Any], usb: dict[str, Any], dry_run: bool) -> None:
        self.mode = mode
        self.network = network
        self.usb = usb
        self.dry_run = dry_run
        self._impl = self._build()

    def _build(self):
        if self.dry_run:
            return self._dry
        if self.mode == "dummy":
            return self._dummy
        if self.mode == "network":
            return self._network
        if self.mode == "usb":
            return self._usb
        log.warning("printer: unknown mode '%s', falling back to dummy", self.mode)
        return self._dummy

    # ── implementations ───────────────────────────────────────────────
    def _dry(self, payload: bytes) -> int:
        log.info("printer [dry-run] %d bytes: %r...", len(payload), payload[:40])
        return len(payload)

    def _dummy(self, payload: bytes) -> int:
        # No-op. Logged once at debug only so it doesn't spam prod logs.
        log.debug("printer [dummy] swallowed %d bytes", len(payload))
        return len(payload)

    def _network(self, payload: bytes) -> int:
        host = self.network.get("host", "127.0.0.1")
        port = int(self.network.get("port", 9100))
        timeout = float(self.network.get("timeout_sec", 2.0))
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.sendall(payload)
        return len(payload)

    def _usb(self, payload: bytes) -> int:
        # Lazy import so the package isn't required in dummy/network mode.
        try:
            from escpos.printer import Usb  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "USB mode requires python-escpos + pyusb. "
                "pip install python-escpos pyusb; on Linux also add a udev rule "
                "for the printer (see Settings page help)."
            ) from e
        vid = int(self.usb.get("vendor_id", 0x04B8))
        pid = int(self.usb.get("product_id", 0x0202))
        p = Usb(vid, pid)
        try:
            p._raw(payload)  # noqa: SLF001 — the public API is verbose for byte payloads
        finally:
            try:
                p.close()
            except Exception:
                pass
        return len(payload)

    def write(self, payload: bytes) -> int:
        return self._impl(payload)


# ── Public API ────────────────────────────────────────────────────────
def get_config() -> dict[str, Any]:
    """Return the current printer config (with defaults filled in)."""
    return _load_config()


def update_config(patch: dict[str, Any]) -> dict[str, Any]:
    """Merge `patch` into the current config and persist."""
    cfg = _load_config()
    for section, vals in patch.items():
        if section not in cfg:
            cfg[section] = vals
            continue
        if isinstance(vals, dict) and isinstance(cfg[section], dict):
            cfg[section].update(vals)
        else:
            cfg[section] = vals
    _save_config(cfg)
    return cfg


def print_bytes(payload: bytes) -> PrintResult:
    """Send `payload` to the configured printer.

    Never raises. Always returns a PrintResult. Logs at warning on failure.
    """
    cfg = _load_config()
    started = time.monotonic()
    sender = _Sender(
        mode=cfg.get("mode", "dummy"),
        network=cfg.get("network", {}),
        usb=cfg.get("usb", {}),
        dry_run=bool(cfg.get("dry_run", False)),
    )
    try:
        n = sender.write(payload)
    except Exception as e:
        log.warning("printer: write failed (mode=%s dry_run=%s): %s",
                    cfg.get("mode"), cfg.get("dry_run"), e)
        return PrintResult(
            ok=False,
            mode=cfg.get("mode", "dummy"),
            dry_run=bool(cfg.get("dry_run", False)),
            bytes_written=0,
            error=str(e),
            elapsed_ms=int((time.monotonic() - started) * 1000),
        )
    elapsed = int((time.monotonic() - started) * 1000)
    log.info("printer: ok mode=%s dry_run=%s bytes=%d elapsed=%dms",
             cfg.get("mode"), cfg.get("dry_run"), n, elapsed)
    return PrintResult(
        ok=True,
        mode=cfg.get("mode", "dummy"),
        dry_run=bool(cfg.get("dry_run", False)),
        bytes_written=n,
        elapsed_ms=elapsed,
    )


def auto_print_on_event(event: str, payload_bytes: bytes) -> PrintResult | None:
    """Print `payload_bytes` iff `event` is in the auto_print whitelist.

    Returns None if auto-print is disabled for this event (so the caller
    knows to skip silently — no log noise). Returns the PrintResult if the
    event was triggered.
    """
    cfg = _load_config()
    auto = cfg.get("auto_print", {}) or {}
    if not auto.get(event):
        return None
    return print_bytes(payload_bytes)
