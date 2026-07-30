export type Permission =
  | 'dashboard.view'
  | 'cashier.view'
  | 'waiter.view'
  | 'kitchen.view'
  | 'bar.view'
  | 'admin.view'
  | 'admin.manage_menu'
  | 'admin.manage_tables'
  | 'admin.manage_users'
  | 'admin.manage_settings';

export const ROLE_DEFAULTS: Record<string, Permission[]> = {
  admin: [
    'dashboard.view', 'cashier.view', 'waiter.view', 'kitchen.view', 'bar.view', 'admin.view',
    'admin.manage_menu', 'admin.manage_tables', 'admin.manage_users', 'admin.manage_settings',
  ],
  cashier: ['dashboard.view', 'cashier.view'],
  waiter: ['dashboard.view', 'waiter.view'],
  kitchen: ['dashboard.view', 'kitchen.view', 'bar.view'],
};

export const hasPermission = (
  user: { role: string; permissions?: string[] } | null,
  permission: Permission,
) => Boolean(user && (user.role === 'admin' || (user.permissions ?? ROLE_DEFAULTS[user.role] ?? []).includes(permission)));
