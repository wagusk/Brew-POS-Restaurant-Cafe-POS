"""Permission catalog and role defaults for the multipage POS workspace."""
from __future__ import annotations

from typing import Iterable

# Keep these stable: they are persisted in user permissions and referenced by UI routes.
PERMISSIONS = (
    # Page access
    "dashboard.view",
    "cashier.view",
    "waiter.view",
    "kitchen.view",
    "bar.view",
    "menu.view",
    "admin.view",
    "settings.view",
    # Task permissions
    "order.open",        # Create new order / open bill
    "order.close",       # Close bill / process payment
    "order.cancel",      # Cancel order or item
    "order.discount",    # Apply discount at checkout
    "order.append",      # Add items to existing bill
    "kitchen.serve",     # Mark kitchen items as served
    "bar.serve",         # Mark bar items as served
    # Admin privileges
    "admin.manage_menu",
    "admin.manage_tables",
    "admin.manage_users",
    "admin.manage_settings",
    "admin.reports",
)

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": set(PERMISSIONS),
    "master": set(PERMISSIONS),
    # Cashier: can open orders, close bills, apply discounts
    "cashier": {
        "dashboard.view", "cashier.view", "menu.view",
        "order.open", "order.close", "order.cancel", "order.discount", "order.append",
    },
    # Waiter: can open orders, add items, but not close bills
    "waiter": {
        "dashboard.view", "waiter.view", "menu.view",
        "order.open", "order.append",
    },
    # Kitchen: can view kitchen/bar, mark items served
    "kitchen": {
        "dashboard.view", "kitchen.view", "bar.view", "menu.view",
        "kitchen.serve", "bar.serve",
    },
    # Bar: same as kitchen (can view both stations, serve both)
    "bar": {
        "dashboard.view", "kitchen.view", "bar.view", "menu.view",
        "kitchen.serve", "bar.serve",
    },
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
