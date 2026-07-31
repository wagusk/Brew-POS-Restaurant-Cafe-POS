import { useState, useEffect, type ReactNode } from 'react';
import { AppBar, Toolbar, Box, Typography, Button, Chip } from '@mui/material';
import CoffeeIcon from '@mui/icons-material/Coffee';
import LogoutIcon from '@mui/icons-material/Logout';
import RouterIcon from '@mui/icons-material/Router';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/authSlice';
import { ws } from '../lib/ws';
import { useNavigate, useLocation } from 'react-router-dom';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SoupKitchenIcon from '@mui/icons-material/SoupKitchen';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { hasPermission, type Permission } from '../lib/permissions';

// Maps a role string to its role palette key in theme.
const roleColor = (role: string): 'cashier' | 'waiter' | 'kitchen' | 'admin' => {
  if (role === 'cashier') return 'cashier';
  if (role === 'waiter') return 'waiter';
  if (role === 'kitchen') return 'kitchen';
  return 'admin';
};

// Both bars share this height — they read as one unified chrome strip.
const BAR_HEIGHT = 64;

// Sidebar width — narrow column for page selection. Fills the entire column.
const SIDEBAR_WIDTH = '8%';

// Menu-bar button palette — idle=yellow (warm, "ready to tap"),
// active=green ("you are here"). 8px radius matches the rest of the app.
const MENU_IDLE_BG = '#f5c518';          // amber/yellow
const MENU_IDLE_BG_HOVER = '#e3b414';
const MENU_IDLE_TEXT = '#3a2d00';
const MENU_ACTIVE_BG = '#1f9d55';        // success green
const MENU_ACTIVE_BG_HOVER = '#178246';
const MENU_ACTIVE_TEXT = '#ffffff';

export default function Shell({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const nav = useNavigate();
  const location = useLocation();
  const user = useAppSelector((s) => s.auth.user);
  const [wsOnline, setWsOnline] = useState(false);

  useEffect(() => {
    ws.connect();
    const off = ws.on((event) => {
      if (event === 'hello' || event === 'pong') setWsOnline(true);
    });
    const t = setInterval(() => setWsOnline((b) => b), 5000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    nav('/login');
  };

  const accent = user ? roleColor(user.role) : 'cashier';
  // Dashboard omitted from sidebar
  const links: Array<{ label: string; path: string; permission: Permission; icon: typeof PointOfSaleIcon }> = [
    { label: 'Cashier', path: '/cashier', permission: 'cashier.view', icon: PointOfSaleIcon },
    { label: 'Waiter', path: '/waiter', permission: 'waiter.view', icon: RestaurantIcon },
    { label: 'Kitchen', path: '/kitchen', permission: 'kitchen.view', icon: SoupKitchenIcon },
    { label: 'Bar', path: '/bar', permission: 'bar.view', icon: LocalBarIcon },
    { label: 'Admin', path: '/admin', permission: 'admin.view', icon: AdminPanelSettingsIcon },
  ];
  const visibleLinks = links.filter((link) => hasPermission(user, link.permission));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'surface.page' }}>
      {/* ── TOP BAR — brand, status, logout (stays on top) ─────────────── */}
      <AppBar position="static">
        <Toolbar sx={{ gap: 1.5, minHeight: BAR_HEIGHT, height: BAR_HEIGHT, px: 2 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: 'role.cashier',
              color: 'common.white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CoffeeIcon sx={{ fontSize: 20 }} />
         </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.25 }}>
            Brew-POS
         </Typography>
          <Box sx={{ flex: 1 }} />
          <Chip
            icon={<RouterIcon sx={{ fontSize: 16 }} />}
            label={wsOnline ? 'Online' : 'Offline'}
            size="small"
            variant="outlined"
            color={wsOnline ? 'success' : 'warning'}
            sx={{ mr: 1 }}
          />
          {user && (
            <Chip
              label={user.role.toUpperCase()}
              size="small"
              sx={{
                mr: 1,
                bgcolor: `role.${accent}`,
                color: 'common.white',
                border: 'none',
              }}
            />
          )}
          {user && (
            <Button
              onClick={handleLogout}
              startIcon={<LogoutIcon />}
              variant="contained"
              sx={{
                bgcolor: '#d8453c',
                color: 'common.white',
                minHeight: 40,
                px: 2,
                fontWeight: 700,
                borderRadius: '8px',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#b1332c', boxShadow: 'none' },
              }}
            >
              Logout
           </Button>
          )}
       </Toolbar>
     </AppBar>

      {/* ── BODY ROW — left sidebar (page picker) + page display, side by side ── */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row', minHeight: 0 }}>
        {/* ── LEFT SIDEBAR — vertical page picker, fills the 8% column ─────── */}
        <Box
          sx={{
            width: SIDEBAR_WIDTH,
            flexShrink: 0,
            bgcolor: 'surface.muted',
            borderRight: '1px solid',
            borderColor: 'border.default',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 1,
            py: 1.5,
            overflowY: 'auto',
          }}
        >
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          // Active = current pathname starts with the link path (so
          // /admin/users still highlights the Admin tab).
          const active =
            location.pathname === link.path ||
            location.pathname.startsWith(link.path);
          return (
            <Button
              key={link.path}
              onClick={() => nav(link.path)}
              startIcon={<Icon />}
              variant="contained"
              disableElevation
              sx={{
                minHeight: 56,
                px: 2,
                fontWeight: 700,
                borderRadius: '8px',
                textTransform: 'none',
                boxShadow: 'none',
                bgcolor: active ? MENU_ACTIVE_BG : MENU_IDLE_BG,
                color: active ? MENU_ACTIVE_TEXT : MENU_IDLE_TEXT,
                '&:hover': {
                  bgcolor: active ? MENU_ACTIVE_BG_HOVER : MENU_IDLE_BG_HOVER,
                  boxShadow: 'none',
                },
                '&:active': { transform: 'translateY(1px)' },
              }}
            >
              {link.label}
           </Button>
          );
        })}
        {visibleLinks.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            No accessible pages
        </Typography>
        )}
    </Box>

        {/* PAGE DISPLAY - side by side with sidebar */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
          {children}
      </Box>
    </Box>
 </Box>
  );
}
