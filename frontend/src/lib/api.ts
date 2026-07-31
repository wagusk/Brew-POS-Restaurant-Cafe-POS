import axios from 'axios';
import type { Order, Product, Category, Table, Stats, User } from '../types';

export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('brewpos_token');
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('brewpos_token');
      localStorage.removeItem('brewpos_user');
      if (location.pathname !== '/login') {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export const Auth = {
  login: (pin: string) => api.post<{ access_token: string; user: User }>('/auth/login', { pin }).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};

export interface AdminCategory {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort: number;
  kind: 'kitchen' | 'bar' | 'both';   // routing hint — controls which station sees the order
}
export interface AdminProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id: number;
  image: string;
  active: boolean;
  kind?: string;  // overrides category station routing
}
export interface AdminTable {
  id: number;
  name: string;
  seats: number;
  active: boolean;
}
export interface AdminUser {
  id: number;
  name: string;
  role: 'admin' | 'master' | 'cashier' | 'waiter' | 'kitchen';
  permissions: string[];
  active?: boolean;
}

export const Admin = {
  listCategories: () => api.get<AdminCategory[]>('/admin/categories').then((r) => r.data),
  createCategory: (p: { name: string; color: string; icon?: string; sort?: number }) =>
    api.post<AdminCategory>('/admin/categories', p).then((r) => r.data),
  updateCategory: (id: number, p: Partial<{ name: string; color: string; icon: string; sort: number }>) =>
    api.patch<AdminCategory>(`/admin/categories/${id}`, p).then((r) => r.data),
  deleteCategory: (id: number) => api.delete<{ deleted: number }>(`/admin/categories/${id}`).then((r) => r.data),

  listProducts: () => api.get<AdminProduct[]>('/admin/products').then((r) => r.data),
  createProduct: (p: { name: string; description?: string; price: number; category_id: number; image?: string; active?: boolean; kind?: string }) =>
    api.post<AdminProduct>('/admin/products', p).then((r) => r.data),
  updateProduct: (id: number, p: Partial<{ name: string; description: string; price: number; category_id: number; image: string; active: boolean; kind?: string }>) =>
    api.patch<AdminProduct>(`/admin/products/${id}`, p).then((r) => r.data),
  deleteProduct: (id: number) => api.delete<{ deleted: number }>(`/admin/products/${id}`).then((r) => r.data),

  listTables: () => api.get<AdminTable[]>('/admin/tables').then((r) => r.data),
  createTable: (p: { name: string; seats?: number; active?: boolean }) =>
    api.post<AdminTable>('/admin/tables', p).then((r) => r.data),
  updateTable: (id: number, p: Partial<{ name: string; seats: number; active: boolean }>) =>
    api.patch<AdminTable>(`/admin/tables/${id}`, p).then((r) => r.data),
  deleteTable: (id: number) => api.delete<{ deleted: number }>(`/admin/tables/${id}`).then((r) => r.data),

  listUsers: () => api.get<AdminUser[]>('/admin/users').then((r) => r.data),
  createUser: (p: { name: string; pin: string; role: string; permissions?: string[]; active?: boolean }) =>
    api.post<AdminUser>('/admin/users', p).then((r) => r.data),
  updateUser: (id: number, p: Partial<{ name: string; pin: string; role: string; permissions: string[]; active: boolean }>) =>
    api.patch<AdminUser>(`/admin/users/${id}`, p).then((r) => r.data),
  deleteUser: (id: number) => api.delete<{ deleted: number }>(`/admin/users/${id}`).then((r) => r.data),
};

export interface SalesSummary {
  period: string;
  total_revenue: number;
  total_orders: number;
  total_items_sold: number;
  avg_order_value: number;
  profit: number;
}

export interface CategorySales {
  category_id: number;
  category_name: string;
  category_color: string;
  revenue: number;
  order_count: number;
  item_count: number;
}

export interface ItemSales {
  product_id: number;
  product_name: string;
  category_name: string;
  category_color: string;
  quantity: number;
  revenue: number;
}

export interface PaymentMethodSummary {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface BillHistoryItem {
  order_id: number;
  order_number: number;
  table_name: string | null;
  customer_name: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  payment_method: string | null;
  created_at: string;
  items: Array<{ id: number; name: string; price: number; qty: number; subtotal: number }>;
}

export const Reports = {
  salesSummary: (period: string, startDate?: string, endDate?: string) =>
    api.get<SalesSummary>('/admin/reports/sales-summary', { params: { period, start_date: startDate, end_date: endDate } }).then((r) => r.data),
  
  salesByCategory: (period: string, startDate?: string, endDate?: string) =>
    api.get<CategorySales[]>('/admin/reports/sales-by-category', { params: { period, start_date: startDate, end_date: endDate } }).then((r) => r.data),
  
  itemSales: (period: string, startDate?: string, endDate?: string, limit = 50) =>
    api.get<ItemSales[]>('/admin/reports/item-sales', { params: { period, start_date: startDate, end_date: endDate, limit } }).then((r) => r.data),
  
  paymentMethods: (period: string, startDate?: string, endDate?: string) =>
    api.get<PaymentMethodSummary[]>('/admin/reports/payment-methods', { params: { period, start_date: startDate, end_date: endDate } }).then((r) => r.data),
  
  billHistory: (period: string, startDate?: string, endDate?: string, status?: string, limit = 100) =>
    api.get<BillHistoryItem[]>('/admin/reports/bill-history', { params: { period, start_date: startDate, end_date: endDate, status, limit } }).then((r) => r.data),
};

export const Menu = {
  full: () => api.get<{ categories: Category[]; products: Product[] }>('/menu').then((r) => r.data),
  tables: () => api.get<Table[]>('/tables').then((r) => r.data),
};

export const Orders = {
  checkout: (payload: unknown) => api.post<Order>('/orders/checkout', payload).then((r) => r.data),
  list: (status?: string, station?: 'kitchen' | 'bar') =>
    api
      .get<Order[]>('/orders', {
        params: {
          ...(status ? { status } : {}),
          ...(station ? { station } : {}),
        },
      })
      .then((r) => r.data),
  get: (id: number) => api.get<Order>(`/orders/${id}`).then((r) => r.data),
  update: (id: number, payload: unknown) => api.patch<Order>(`/orders/${id}`, payload).then((r) => r.data),
  accept: (id: number) => api.post<Order>(`/orders/${id}/accept`, {}).then((r) => r.data),
  close: (id: number, payload: { payment_method: string; tendered: number }) =>
    api.post<Order>(`/orders/${id}/close`, payload).then((r) => r.data),
  cancel: (id: number, payload: { reason: string; item_id?: number }) =>
    api.post<Order>(`/orders/${id}/cancel`, payload).then((r) => r.data),
  appendItems: (id: number, payload: { items: Array<{ product_id: number; qty: number; modifiers?: number[]; notes?: string }> }) =>
    api.post<Order>(`/orders/${id}/items`, payload).then((r) => r.data),
  stats: () => api.get<Stats>('/orders/_stats/today').then((r) => r.data),
};

// ── Settings: tax rate + database location ────────────────────────────
export interface SettingsPayload {
  tax_rate: number;
  database_url: string;
  default_database_url: string;
  db_kind: 'sqlite' | 'postgresql' | 'mysql' | 'other';
  db_file_exists: boolean;
  product_count: number;
  user_count: number;
}

export const Settings = {
  get: () => api.get<SettingsPayload>('/admin/settings').then((r) => r.data),
  setTax: (tax_rate: number) =>
    api.put<SettingsPayload>('/admin/settings/tax', { tax_rate }).then((r) => r.data),
  setDatabase: (database_url: string) =>
    api.put<SettingsPayload>('/admin/settings/database', { database_url }).then((r) => r.data),
  reloadDatabase: () =>
    api.post<SettingsPayload>('/admin/settings/database/reload', {}).then((r) => r.data),
  resetDatabase: () =>
    api.post<SettingsPayload>('/admin/settings/database/reset', {}).then((r) => r.data),
  restoreDefaults: () =>
    api.post<SettingsPayload>('/admin/settings/database/restore-defaults', {}).then((r) => r.data),
  exportDatabaseUrl: () => '/api/admin/settings/database/export',
  importDatabase: (contents_b64: string) =>
    api.post<SettingsPayload>('/admin/settings/database/import', { contents_b64 }).then((r) => r.data),
};
