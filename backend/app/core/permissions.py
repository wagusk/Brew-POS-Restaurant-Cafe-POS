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
    "menu.view",  # Master role always has access to menu page
    "admin.view",
    "admin.manage_menu",
    "admin.manage_tables",
    "admin.manage_users",
    "admin.manage_settings",
    "admin.reports",
)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": set(PERMISSIONS),
    "master": set(PERMISSIONS),  # Master has all permissions including menu access
    "cashier": {"dashboard.view", "cashier.view", "menu.view"},
    "waiter": {"dashboard.view", "waiter.view", "menu.view"},
    "kitchen": {"dashboard.view", "kitchen.view", "bar.view", "menu.view"},
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
    """Admin and Master have emergency full-access role; others use persisted grants."""
    return user.role in ("admin", "master") or permission in (user.permissions or [])
