"""Permission catalog and role defaults for the multipage POS workspace."""
from __future__ import annotations

from typing import Iterable

# Keep these stable: they are persisted in user permissions and referenced by UI routes.
PERMISSIONS = (
    "dashboard.view",
    "cashier.view",
    "waiter.view",
    "kitchen.view",
    "bar.view",
    "admin.view",
    "admin.manage_menu",
    "admin.manage_tables",
    "admin.manage_users",
    "admin.manage_settings",
)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": set(PERMISSIONS),
    "cashier": {"dashboard.view", "cashier.view"},
    "waiter": {"dashboard.view", "waiter.view"},
    "kitchen": {"dashboard.view", "kitchen.view", "bar.view"},
}


def default_permissions(role: str) -> list[str]:
    return sorted(ROLE_PERMISSIONS.get(role, set()))


def normalise_permissions(role: str, permissions: Iterable[str] | None) -> list[str]:
    """Return valid explicit permissions; new users fall back to role defaults."""
    if permissions is None:
        return default_permissions(role)
    allowed = set(PERMISSIONS)
    return sorted({item for item in permissions if item in allowed})


def can(user, permission: str) -> bool:
    """Admin remains an emergency full-access role; others use persisted grants."""
    return user.role == "admin" or permission in (user.permissions or [])
