import { configureStore } from '@reduxjs/toolkit';
import auth from './authSlice';
import cart from './cartSlice';
import menu from './menuSlice';

export const store = configureStore({
  reducer: { auth, cart, menu },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
