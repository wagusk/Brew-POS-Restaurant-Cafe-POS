export type Permission =
  | 'dashboard.view'
  | 'cashier.view'
  | 'waiter.view'
  | 'kitchen.view'
  | 'bar.view'
  | 'menu.view'
  | 'admin.view'
  | 'settings.view'
  | 'admin.manage_menu'
  | 'admin.manage_tables'
  | 'admin.manage_users'
  | 'admin.manage_settings'
  | 'admin.reports';

export const ROLE_DEFAULTS: Record<string, Permission[]> = {
  admin: [
    'dashboard.view', 'cashier.view', 'waiter.view', 'kitchen.view', 'bar.view', 'menu.view', 'admin.view',
    'settings.view',
    'admin.manage_menu', 'admin.manage_tables', 'admin.manage_users', 'admin.manage_settings', 'admin.reports',
  ],
  master: [
    'dashboard.view', 'cashier.view', 'waiter.view', 'kitchen.view', 'bar.view', 'menu.view', 'admin.view',
    'settings.view',
    'admin.manage_menu', 'admin.manage_tables', 'admin.manage_users', 'admin.manage_settings', 'admin.reports',
  ],
  cashier: ['dashboard.view', 'cashier.view', 'menu.view'],
  waiter: ['dashboard.view', 'waiter.view', 'menu.view'],
  kitchen: ['dashboard.view', 'kitchen.view', 'bar.view', 'menu.view'],
};

export const hasPermission = (
  user: { role: string; permissions?: string[] } | null,
  permission: Permission,
) => Boolean(user && (['admin', 'master'].includes(user.role) || (user.permissions ?? ROLE_DEFAULTS[user.role] ?? []).includes(permission)));
