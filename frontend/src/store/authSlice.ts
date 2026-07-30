import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
}

const stored = (() => {
  try {
    const t = localStorage.getItem('brewpos_token');
    const u = localStorage.getItem('brewpos_user');
    return { token: t, user: u ? (JSON.parse(u) as User) : null };
  } catch {
    return { token: null, user: null };
  }
})();

const initial: AuthState = { token: stored.token, user: stored.user };

const slice = createSlice({
  name: 'auth',
  initialState: initial,
  reducers: {
    setAuth(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem('brewpos_token', action.payload.token);
      localStorage.setItem('brewpos_user', JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('brewpos_token');
      localStorage.removeItem('brewpos_user');
    },
  },
});

export const { setAuth, logout } = slice.actions;
export default slice.reducer;
