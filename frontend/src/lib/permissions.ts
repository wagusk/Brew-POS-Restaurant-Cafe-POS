export type Permission =
  | 'dashboard.view'
  | 'cashier.view'
  | 'waiter.view'
  | 'kitchen.view'
  | 'bar.view'
  | 'menu.view'
  | 'admin.view'
  | 'settings.view'
  | 'order.open'
  | 'order.close'
  | 'order.cancel'
  | 'order.discount'
  | 'order.append'
  | 'kitchen.serve'
  | 'bar.serve'
  | 'admin.manage_menu'
  | 'admin.manage_tables'
  | 'admin.manage_users'
  | 'admin.manage_settings'
  | 'admin.reports';

export const ROLE_DEFAULTS: Record<string, Permission[]> = {
  admin: [
    'dashboard.view', 'cashier.view', 'waiter.view', 'kitchen.view', 'bar.view', 'menu.view', 'admin.view',
    'settings.view',
    'order.open', 'order.close', 'order.cancel', 'order.discount', 'order.append',
    'kitchen.serve', 'bar.serve',
    'admin.manage_menu', 'admin.manage_tables', 'admin.manage_users', 'admin.manage_settings', 'admin.reports',
  ],
  master: [
    'dashboard.view', 'cashier.view', 'waiter.view', 'kitchen.view', 'bar.view', 'menu.view', 'admin.view',
    'settings.view',
    'order.open', 'order.close', 'order.cancel', 'order.discount', 'order.append',
    'kitchen.serve', 'bar.serve',
    'admin.manage_menu', 'admin.manage_tables', 'admin.manage_users', 'admin.manage_settings', 'admin.reports',
  ],
  cashier: ['dashboard.view', 'cashier.view', 'menu.view', 'order.open', 'order.close', 'order.cancel', 'order.discount', 'order.append'],
  waiter: ['dashboard.view', 'waiter.view', 'menu.view', 'order.open', 'order.append'],
  kitchen: ['dashboard.view', 'kitchen.view', 'bar.view', 'menu.view', 'kitchen.serve', 'bar.serve'],
};

export const hasPermission = (
  user: { role: string; permissions?: string[] } | null,
  permission: Permission,
) => Boolean(user && (['admin', 'master'].includes(user.role) || (user.permissions ?? ROLE_DEFAULTS[user.role] ?? []).includes(permission)));
