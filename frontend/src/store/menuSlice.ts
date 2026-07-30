import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Category, Product, Table } from '../types';

interface MenuState {
  categories: Category[];
  products: Product[];
  tables: Table[];
  loaded: boolean;
}

const initial: MenuState = { categories: [], products: [], tables: [], loaded: false };

const slice = createSlice({
  name: 'menu',
  initialState: initial,
  reducers: {
    setMenu(
      state,
      action: PayloadAction<{ categories: Category[]; products: Product[]; tables: Table[] }>,
    ) {
      state.categories = action.payload.categories;
      state.products = action.payload.products;
      state.tables = action.payload.tables;
      state.loaded = true;
    },
  },
});

export const { setMenu } = slice.actions;
export default slice.reducer;
