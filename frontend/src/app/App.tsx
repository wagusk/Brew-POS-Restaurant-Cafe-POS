import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';

import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setMenu } from '../store/menuSlice';
import { Menu } from '../lib/api';
import { ws } from '../lib/ws';
import { hasPermission, type Permission } from '../lib/permissions';
import type { User } from '../types';

import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/DashboardPage';
import CashierPage from '../pages/CashierPage';
import WaiterPage from '../pages/WaiterPage';
import KitchenPage from '../pages/KitchenPage';
import BarPage from '../pages/BarPage';
import AdminPage from '../pages/AdminPage';
import SettingsPage from '../pages/SettingsPage';
import Shell from '../components/Shell';

function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  return hasPermission(user, permission) ? children : <NoAccess />;
}

function RoleRouter() {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
     </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to={defaultPath(user)} replace />} />
        <Route
          path="/dashboard"
          element={
            <PermissionRoute permission="dashboard.view">
              <DashboardPage />
           </PermissionRoute>
          }
        />
        <Route
          path="/cashier"
          element={
            <PermissionRoute permission="cashier.view">
              <CashierPage />
           </PermissionRoute>
          }
        />
        <Route
          path="/waiter"
          element={
            <PermissionRoute permission="waiter.view">
              <WaiterPage />
           </PermissionRoute>
          }
        />
        <Route
          path="/kitchen"
          element={
            <PermissionRoute permission="kitchen.view">
              <KitchenPage />
           </PermissionRoute>
          }
        />
        <Route
          path="/bar"
          element={
            <PermissionRoute permission="bar.view">
              <BarPage />
           </PermissionRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <PermissionRoute permission="admin.view">
              <AdminPage />
            </PermissionRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <PermissionRoute permission="settings.view">
              <SettingsPage />
            </PermissionRoute>
          }
        />
        <Route path="/login" element={<Navigate to={defaultPath(user)} replace />} />
        <Route path="*" element={<Navigate to={defaultPath(user)} replace />} />
     </Routes>
   </Shell>
  );
}

// Landing-page priority — first entry the user has permission for wins.
// Order matches the sidebar reading order so post-login destination matches
// the leftmost button on the menu list.
export function defaultPath(user: User) {
  const first = [
    ['cashier.view', '/cashier'],
    ['waiter.view', '/waiter'],
    ['kitchen.view', '/kitchen'],
    ['bar.view', '/bar'],
    ['admin.view', '/admin'],
    ['settings.view', '/settings'],
  ] as const;
  return first.find(([permission]) => hasPermission(user, permission))?.[1] ?? '/login';
}

function NoAccess() {
  const nav = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h5" fontWeight={800}>Access denied</Typography>
      <Typography color="text.secondary" sx={{ my: 1 }}>
        Your account has no permission for this page.
   </Typography>
      <Button variant="contained" onClick={() => nav(user ? defaultPath(user) : '/login')}>
        Back
   </Button>
 </Box>
  );
}

export function App() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    ws.connect();
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([Menu.full(), Menu.tables()]).then(([full, tables]) => {
      dispatch(setMenu({ categories: full.categories, products: full.products, tables }));
    });
  }, [user, dispatch]);

  return <RoleRouter />;
}
