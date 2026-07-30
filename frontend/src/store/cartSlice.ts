import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { CartItem, Product, ModifierOption } from '../types';

interface CartState {
  items: CartItem[];
  tableId: number | null;
  type: string;
  customerName: string;
  notes: string;
  // When the waiter opens an OpenBill tile, the existing bill is loaded
  // into the cart for read-only display. New items added on top will be
  // POSTed to /api/orders/{id}/items, NOT to /checkout. We track this so
  // the Send-to-Kitchen button knows which endpoint to hit.
  appendingToOrderId: number | null;
}

const initial: CartState = {
  items: [],
  tableId: null,
  type: 'dine_in',
  customerName: '',
  notes: '',
  appendingToOrderId: null,
};

let uid = 0;

const slice = createSlice({
  name: 'cart',
  initialState: initial,
  reducers: {
    add(state, action: PayloadAction<{ product: Product; qty?: number; modifiers?: ModifierOption[]; notes?: string }>) {
      const { product, qty = 1, modifiers = [], notes = '' } = action.payload;
      // Match if same product + same modifiers + same notes
      const key = (mods: ModifierOption[], n: string) =>
        `${mods.map((m) => m.id).sort().join(',')}|${n}`;
      const existing = state.items.find(
        (i) => i.product.id === product.id && key(i.modifiers, i.notes) === key(modifiers, notes),
      );
      if (existing) {
        existing.qty += qty;
      } else {
        state.items.push({
          uid: `c${++uid}`,
          product,
          qty,
          modifiers,
          notes,
        });
      }
    },
    setQty(state, action: PayloadAction<{ uid: string; qty: number }>) {
      // Items seeded from an existing bill are read-only in the cart sidebar.
      const i = state.items.find((x) => x.uid === action.payload.uid);
      if (i && !i.fromExisting) i.qty = Math.max(1, action.payload.qty);
    },
    remove(state, action: PayloadAction<string>) {
      // Items seeded from an existing bill cannot be removed from the cart
      // sidebar — they represent the bill already sent to the kitchen.
      state.items = state.items.filter(
        (i) => !(i.uid === action.payload && i.fromExisting),
      );
    },
    clear(state) {
      state.items = [];
      state.notes = '';
      state.customerName = '';
      state.appendingToOrderId = null;
    },
    setTable(state, action: PayloadAction<number | null>) {
      state.tableId = action.payload;
    },
    setType(state, action: PayloadAction<string>) {
      state.type = action.payload;
    },
    setCustomer(state, action: PayloadAction<string>) {
      state.customerName = action.payload;
    },
    setNotes(state, action: PayloadAction<string>) {
      state.notes = action.payload;
    },
    // Seed the cart from an existing bill. The seeded items are flagged
    // `fromExisting` so the +/- / remove controls disable against them.
    seedFromExisting(
      state,
      action: PayloadAction<{
        orderId: number;
        items: Array<{
          product: Product;
          qty: number;
          modifiers?: ModifierOption[];
          notes?: string;
          existingItemId: number;
        }>;
      }>,
    ) {
      const { orderId, items } = action.payload;
      state.items = items.map((it) => ({
        uid: `x${++uid}`,
        product: it.product,
        qty: it.qty,
        modifiers: it.modifiers ?? [],
        notes: it.notes ?? '',
        fromExisting: true,
        existingItemId: it.existingItemId,
      }));
      state.appendingToOrderId = orderId;
    },
    setAppendingTo(state, action: PayloadAction<number | null>) {
      state.appendingToOrderId = action.payload;
    },
  },
});

export const {
  add, setQty, remove, clear, setTable, setType, setCustomer, setNotes,
  seedFromExisting, setAppendingTo,
} = slice.actions;
export default slice.reducer;
