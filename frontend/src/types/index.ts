export interface User {
  id: number;
  name: string;
  role: 'admin' | 'cashier' | 'waiter' | 'kitchen';
  permissions: string[];
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  sort: number;
}

export interface ModifierOption {
  id: number;
  name: string;
  price_delta: number;
}

export interface ModifierGroup {
  id: number;
  name: string;
  required: boolean;
  multi: boolean;
  options: ModifierOption[];
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category_id: number;
  image: string;
  active: boolean;
  modifier_groups: ModifierGroup[];
}

export interface Table {
  id: number;
  name: string;
  seats: number;
  active: boolean;
}

export interface CartItem {
  uid: string; // local id
  product: Product;
  qty: number;
  modifiers: ModifierOption[];
  notes: string;
  // `fromExisting` is true for items that were seeded from the existing
  // bill when the waiter opens an OpenBill tile. They are display-only in
  // the cart sidebar — the +/- / remove / Send-to-Kitchen flow keeps them
  // intact so the original bill stays untouched until the API appends new
  // items.
  fromExisting?: boolean;
  existingItemId?: number;
}

export interface OrderItemMod {
  id: number;
  name: string;
  price_delta: number;
}

export interface OrderItem {
  id: number;
  product_id: number;
  name: string;
  price: number;
  qty: number;
  status: string;
  notes: string;
  sent_at: string | null;
  station?: 'kitchen' | 'bar';  // routing hint from M14.7 — defaults to kitchen on legacy rows
  modifiers: OrderItemMod[];
}

export interface Payment {
  id: number;
  order_id: number;
  method: string;
  amount: number;
  tendered: number;
  change: number;
  created_at: string;
}

export interface Order {
  id: number;
  number: number;
  table_id: number | null;
  status: string;
  type: string;
  customer_name: string;
  notes: string;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payments: Payment[];
}

export interface Stats {
  today_orders: number;
  today_revenue: number;
  open_tickets: number;
  avg_ticket: number;
}
