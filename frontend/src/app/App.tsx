import { Suspense, lazy, useEffect, useState, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography, ThemeProvider, createTheme } from '@mui/material';

import { useAppSelector, useAppDispatch } from '../store/hooks';
import { setMenu } from '../store/menuSlice';
import { Menu, Settings } from '../lib/api';
import { ws } from '../lib/ws';
import { hasPermission, type Permission } from '../lib/permissions';
import { theme as baseTheme } from '../theme';
import type { SettingsPayload } from '../lib/api';
import type { User } from '../types';

import Shell from '../components/Shell';

// Route-level code splitting — each page loads on demand instead of
// being bundled into the single >1 MB main chunk.
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const CashierPage = lazy(() => import('../pages/CashierPage'));
const WaiterPage = lazy(() => import('../pages/WaiterPage'));
const KitchenPage = lazy(() => import('../pages/KitchenPage'));
const BarPage = lazy(() => import('../pages/BarPage'));
const AdminPage = lazy(() => import('../pages/AdminPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));

function PageFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
      <CircularProgress />
   </Box>
  );
}

function PermissionRoute({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  return hasPermission(user, permission) ? children : <NoAccess />;
}

function RoleRouter() {
  const user = useAppSelector((state) => state.auth.user);

  if (!user) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
       </Routes>
     </Suspense>
    );
  }

  return (
    <Shell>
      <Suspense fallback={<PageFallback />}>
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
     </Suspense>
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
  const [textSize, setTextSize] = useState(1.0);

  useEffect(() => {
    ws.connect();
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([Menu.full(), Menu.tables()]).then(([full, tables]) => {
      dispatch(setMenu({ categories: full.categories, products: full.products, tables }));
    });
  }, [user, dispatch]);

  useEffect(() => {
    Settings.get().then((s: SettingsPayload) => {
      if (s.text_size) setTextSize(s.text_size);
    }).catch(() => {});
  }, []);

  const theme = useMemo(() => createTheme({
    ...baseTheme,
    typography: {
      ...baseTheme.typography,
      fontSize: Math.round(14 * textSize),
    },
  }), [textSize]);

  return (
    <ThemeProvider theme={theme}>
      <RoleRouter />
    </ThemeProvider>
  );
}
